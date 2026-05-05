import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import type { AsyncOperationItem } from '@/shared/ui/AsyncOperationsPanel';
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/shared/lib/masks';
import { formatCurrency } from '@/shared/lib/formatters';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { CatalogAsyncJob, CatalogCategory, CatalogItem } from '@/shared/types';

const DEFAULT_CATEGORY_FORM = {
  name: '',
  description: '',
  parentCategoryId: '',
};

const DEFAULT_ITEM_FORM = {
  name: '',
  type: 'SERVICE' as 'SERVICE' | 'PRODUCT' | 'RENTAL',
  categoryId: '',
  basePrice: '',
  externalReference: '',
  initialStock: '',
  description: '',
  tags: '',
  source: 'MANUAL' as 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT',
  imageUrl: '',
  customFields: [] as Array<{ id: string; key: string; value: string }>,
  variants: [] as Array<{
    id: string;
    name: string;
    reference: string;
    price: string;
    stock: string;
    fields: Array<{ id: string; key: string; value: string }>;
  }>,
  optionGroups: [] as Array<{
    id: string;
    name: string;
    required: boolean;
    min: string;
    max: string;
    options: Array<{
      id: string;
      name: string;
      priceDelta: string;
      sku: string;
      active: boolean;
    }>;
  }>,
};

const DEFAULT_REPORT_FILTERS = {
  query: '',
  types: [] as Array<'SERVICE' | 'PRODUCT' | 'RENTAL'>,
  categoryIds: [] as string[],
  includeInactive: false,
};

const DEFAULT_IMPORT_FORM = {
  rawText: '',
  defaultType: 'PRODUCT' as 'PRODUCT' | 'SERVICE' | 'RENTAL',
  defaultCategoryName: '',
  defaultSource: 'IMPORT' as 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT',
  defaultTags: '',
  syncInventory: true,
};

function isActiveJob(job?: CatalogAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createFormId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringifyFieldValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function customFieldsToAttributes(
  fields: Array<{ key: string; value: string }>,
): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((attributes, field) => {
    const key = field.key.trim();
    const value = field.value.trim();
    if (!key || !value) return attributes;
    attributes[key] = value;
    return attributes;
  }, {});
}

function attributesToCustomFields(attributes?: Record<string, unknown>) {
  return Object.entries(attributes ?? {}).map(([key, value]) => ({
    id: createFormId('field'),
    key,
    value: stringifyFieldValue(value),
  }));
}

function variantsToPayload(
  variants: typeof DEFAULT_ITEM_FORM.variants,
): Array<Record<string, unknown>> {
  return variants
    .map((variant) => {
      const attributes = customFieldsToAttributes(variant.fields);
      return {
        name: variant.name.trim(),
        reference: variant.reference.trim(),
        price: parseCurrencyInput(variant.price),
        stock: variant.stock.trim() ? Number(variant.stock.replace(',', '.')) : undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
    })
    .map((variant) =>
      Object.fromEntries(
        Object.entries(variant).filter(([, value]) => value !== '' && value !== undefined),
      ),
    )
    .filter((variant) => Object.keys(variant).length > 0);
}

function parseStockInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : undefined;
}

function payloadToVariants(variants?: Array<Record<string, unknown>>) {
  return (variants ?? []).map((variant) => ({
    id: createFormId('variant'),
    name: stringifyFieldValue(variant.name),
    reference: stringifyFieldValue(variant.reference ?? variant.sku),
    price:
      variant.price == null ? '' : formatCurrencyInput(String(Math.round(Number(variant.price) * 100))),
    stock: stringifyFieldValue(variant.stock),
    fields: attributesToCustomFields(
      (variant.attributes && typeof variant.attributes === 'object'
        ? variant.attributes
        : Object.fromEntries(
            Object.entries(variant).filter(
              ([key]) => !['name', 'reference', 'sku', 'price', 'stock'].includes(key),
            ),
          )) as Record<string, unknown>,
    ),
  }));
}

function optionGroupsToPayload(
  optionGroups: typeof DEFAULT_ITEM_FORM.optionGroups,
): Array<Record<string, unknown>> {
  return optionGroups
    .map((group) => {
      const options = group.options
        .map((option) => ({
          name: option.name.trim(),
          priceDelta: parseCurrencyInput(option.priceDelta) || '0.00',
          sku: option.sku.trim() || undefined,
          active: option.active,
        }))
        .filter((option) => option.name);

      return {
        name: group.name.trim(),
        required: group.required,
        min: group.required ? Math.max(1, Number(group.min || 1)) : Math.max(0, Number(group.min || 0)),
        max: Math.max(1, Number(group.max || 1)),
        options,
      };
    })
    .filter((group) => group.name && group.options.length > 0);
}

function payloadToOptionGroups(optionGroups?: Array<Record<string, unknown>>) {
  return (optionGroups ?? []).map((group) => ({
    id: createFormId('option-group'),
    name: stringifyFieldValue(group.name),
    required: group.required === true,
    min: stringifyFieldValue(group.min ?? (group.required ? 1 : 0)),
    max: stringifyFieldValue(group.max ?? 1),
    options: Array.isArray(group.options)
      ? (group.options as Array<Record<string, unknown>>).map((option) => ({
          id: createFormId('option'),
          name: stringifyFieldValue(option.name),
          priceDelta:
            option.priceDelta == null
              ? ''
              : formatCurrencyInput(String(Math.round(Number(option.priceDelta) * 100))),
          sku: stringifyFieldValue(option.sku),
          active: option.active !== false,
        }))
      : [],
  }));
}

export function useCatalogPageViewModel() {
  const tenant = useAuthStore((state) => state.tenant);
  const queryClient = useQueryClient();
  const PAGE_SIZE = 12;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE' | 'RENTAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [reportsOpen, setReportsOpenState] = useState(false);
  const [importOpen, setImportOpenState] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CatalogCategory | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<CatalogItem | null>(null);
  const [categoryForm, setCategoryForm] = useState(DEFAULT_CATEGORY_FORM);
  const [itemForm, setItemForm] = useState(DEFAULT_ITEM_FORM);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [importForm, setImportForm] = useState(DEFAULT_IMPORT_FORM);
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const [currentImportJobId, setCurrentImportJobId] = useState<string | null>(null);
  const handledJobsRef = useRef<Record<string, string>>({});

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => catalogService.listCategories(tenant!.id),
  });

  const itemsQuery = useQuery({
    queryKey: ['catalog-items', tenant?.id, typeFilter, showInactive],
    enabled: Boolean(tenant?.id),
    queryFn: () =>
      catalogService.listItems(tenant!.id, {
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        includeInactive: showInactive,
      }),
  });

  const jobsQuery = useQuery({
    queryKey: ['catalog-async-jobs', tenant?.id],
    queryFn: () => catalogService.listAsyncJobs(tenant!.id),
    enabled: Boolean(tenant?.id),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as CatalogAsyncJob[];
      return jobs.some((job) => isActiveJob(job)) ? 3000 : false;
    },
  });

  const pollingJobId = currentReportJobId ?? currentImportJobId ?? null;

  const focusedJobQuery = useQuery({
    queryKey: ['catalog-async-job', tenant?.id, pollingJobId],
    enabled: Boolean(tenant?.id && pollingJobId),
    queryFn: () => catalogService.getAsyncJob(tenant!.id, pollingJobId!),
    refetchInterval: (query) => {
      const job = query.state.data as CatalogAsyncJob | undefined;
      return job && isActiveJob(job) ? 2500 : false;
    },
  });

  function resolveJobFromList(jobId: string | null) {
    return jobId ? ((jobsQuery.data ?? []).find((job) => job.id === jobId) ?? null) : null;
  }

  const activeReportJob = useMemo(() => {
    if (!currentReportJobId) {
      return null;
    }

    if (focusedJobQuery.data?.id === currentReportJobId) {
      return focusedJobQuery.data;
    }

    return resolveJobFromList(currentReportJobId);
  }, [currentReportJobId, focusedJobQuery.data, jobsQuery.data]);

  const activeImportJob = useMemo(() => {
    if (!currentImportJobId) {
      return null;
    }

    if (focusedJobQuery.data?.id === currentImportJobId) {
      return focusedJobQuery.data;
    }

    return resolveJobFromList(currentImportJobId);
  }, [currentImportJobId, focusedJobQuery.data, jobsQuery.data]);

  const activeJobItems = useMemo<AsyncOperationItem[]>(
    () =>
      (jobsQuery.data ?? [])
        .filter((job) => isActiveJob(job))
        .map((job) => ({
          id: job.id,
          title:
            job.type === 'IMPORT_CATALOG_ITEMS'
              ? 'Importação de catalogo'
              : 'Exportação de catalogo',
          description:
            job.type === 'IMPORT_CATALOG_ITEMS'
              ? 'Estamos ajustando a planilha ao modelo do produto e criando itens em segundo plano.'
              : 'Estamos consolidando os itens e categorias para montar o CSV.',
          status: job.status,
          progress: job.progress,
          processedItems: job.processedItems,
          totalItems: job.totalItems,
        })),
    [jobsQuery.data],
  );

  useEffect(() => {
    if (!activeReportJob || handledJobsRef.current[activeReportJob.id] === activeReportJob.status) {
      return;
    }

    if (activeReportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);

      void catalogService
        .downloadAsyncJobFile(tenant!.id, activeReportJob.id, activeReportJob.fileName ?? undefined)
        .then(() => {
          toast({
            title: 'CSV do catalogo exportado',
            description:
              Number(activeReportJob.resultSummary?.totalItems ?? 0) > 0
                ? `${Number(activeReportJob.resultSummary?.totalItems ?? 0)} itens foram incluidos no arquivo.`
                : 'O arquivo foi gerado sem itens para os filtros escolhidos.',
          });
        })
        .catch((error) => {
          toast({
            title: 'CSV pronto, mas falhou o download',
            description: getFriendlyErrorMessage(error, {
              fallbackMessage: 'Tente gerar novamente ou atualizar a pagina.',
            }),
            variant: 'destructive',
          });
        });
    }

    if (activeReportJob.status === 'FAILED') {
      handledJobsRef.current[activeReportJob.id] = activeReportJob.status;
      setCurrentReportJobId(null);
      toast({
        title: 'Falha ao exportar catalogo',
        description:
          activeReportJob.errorMessage ?? 'não foi possivel gerar o CSV do catalogo.',
        variant: 'destructive',
      });
    }
  }, [activeReportJob, tenant]);

  useEffect(() => {
    if (!activeImportJob || handledJobsRef.current[activeImportJob.id] === activeImportJob.status) {
      return;
    }

    if (activeImportJob.status === 'COMPLETED') {
      handledJobsRef.current[activeImportJob.id] = activeImportJob.status;
      setCurrentImportJobId(null);
      void queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({
        title: 'Importação concluida',
        description:
          Number(activeImportJob.resultSummary?.created ?? 0) > 0 ||
            Number(activeImportJob.resultSummary?.updated ?? 0) > 0
            ? `${Number(activeImportJob.resultSummary?.created ?? 0)} itens criados e ${Number(activeImportJob.resultSummary?.updated ?? 0)} atualizados.`
            : 'A importação terminou sem alterar itens.',
      });
    }

    if (activeImportJob.status === 'FAILED') {
      handledJobsRef.current[activeImportJob.id] = activeImportJob.status;
      setCurrentImportJobId(null);
      toast({
        title: 'Falha ao importar catalogo',
        description:
          activeImportJob.errorMessage ?? 'não foi possivel processar a base agora.',
        variant: 'destructive',
      });
    }
  }, [activeImportJob, queryClient]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (itemsQuery.data ?? []).filter((item) => {
      if (!normalized) return true;
      return [
        item.name,
        item.categoryName,
        item.externalReference,
        item.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [itemsQuery.data, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, showInactive]);

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      catalogService.createCategory(tenant!.id, {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        parentCategoryId: categoryForm.parentCategoryId || undefined,
      }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-categories', tenant?.id] });
      setCreateCategoryOpen(false);
      setCategoryForm(DEFAULT_CATEGORY_FORM);
      if (createItemOpen) {
        setItemForm((current) => ({
          ...current,
          categoryId: category.id,
        }));
      }
      toast({
        title: 'Categoria criada',
        description: 'A categoria foi adicionada ao catalogo com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar categoria',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel criar a categoria agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: () =>
      catalogService.updateCategory(tenant!.id, selectedCategory!.id, {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        parentCategoryId: categoryForm.parentCategoryId || undefined,
      }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
      setCreateCategoryOpen(false);
      setSelectedCategory(category);
      toast({
        title: 'Categoria atualizada',
        description: 'A categoria foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar categoria',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel atualizar a categoria agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => catalogService.deleteCategory(tenant!.id, categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
      setDeleteCategoryTarget(null);
      setSelectedCategory(null);
      toast({
        title: 'Categoria removida',
        description: 'A categoria saiu da operação ativa.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao remover categoria',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel remover a categoria agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: () =>
      catalogService.createItem(tenant!.id, {
        name: itemForm.name.trim(),
        type: itemForm.type,
        categoryId: itemForm.categoryId || undefined,
        basePrice: parseCurrencyInput(itemForm.basePrice),
        externalReference: itemForm.externalReference.trim() || undefined,
        description: itemForm.description.trim() || undefined,
        tags: splitTags(itemForm.tags),
        source: itemForm.source,
        imageUrl: itemForm.imageUrl || undefined,
        initialStock:
          itemForm.variants.length === 0 ? parseStockInput(itemForm.initialStock) : undefined,
        attributes: customFieldsToAttributes(itemForm.customFields),
        variants: variantsToPayload(itemForm.variants),
        optionGroups: optionGroupsToPayload(itemForm.optionGroups),
      }),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      setCreateItemOpen(false);
      setItemForm(DEFAULT_ITEM_FORM);
      setSelectedItem(item);
      toast({
        title: 'Item criado',
        description: 'O item entrou no catalogo com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar item',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel criar o item agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: () =>
      catalogService.updateItem(tenant!.id, selectedItem!.id!, {
        name: itemForm.name.trim(),
        type: itemForm.type,
        categoryId: itemForm.categoryId || undefined,
        basePrice: parseCurrencyInput(itemForm.basePrice),
        externalReference: itemForm.externalReference.trim() || undefined,
        description: itemForm.description.trim() || undefined,
        tags: splitTags(itemForm.tags),
        imageUrl: itemForm.imageUrl || undefined,
        attributes: customFieldsToAttributes(itemForm.customFields),
        variants: variantsToPayload(itemForm.variants),
        optionGroups: optionGroupsToPayload(itemForm.optionGroups),
      }),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      setCreateItemOpen(false);
      setSelectedItem(item);
      toast({
        title: 'Item atualizado',
        description: 'O item foi atualizado no catalogo.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao atualizar item',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel atualizar o item agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => catalogService.deleteItem(tenant!.id, itemId),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      setSelectedItem(item);
      setDeleteItemTarget(null);
      toast({
        title: 'Item removido',
        description: 'O item foi retirado da operação ativa.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao remover item',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel remover o item agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const uploadItemImageMutation = useMutation({
    mutationFn: (file: File) => catalogService.uploadImage(tenant!.id, file),
    onSuccess: (data) => {
      setItemForm((current) => ({
        ...current,
        imageUrl: data.imageUrl,
      }));
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi carregada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha no upload',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel carregar a imagem.',
        }),
        variant: 'destructive',
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: (overrideFilters?: typeof DEFAULT_REPORT_FILTERS) => {
      const filters = overrideFilters ?? reportFilters;

      return catalogService.startReportJob(tenant!.id, {
        query: filters.query.trim() || undefined,
        types: filters.types,
        categoryIds: filters.categoryIds,
        includeInactive: filters.includeInactive,
      });
    },
    onSuccess: async (job) => {
      setCurrentReportJobId(job.id);
      setReportsOpenState(false);
      await queryClient.invalidateQueries({ queryKey: ['catalog-async-jobs', tenant?.id] });
      toast({
        title: 'Relatorio enfileirado',
        description:
          'Vamos processar o catalogo em segundo plano e iniciar o download quando o CSV ficar pronto.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar exportação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel enfileirar o relatorio agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  const syncReportSummaryMutation = useMutation({
    mutationFn: (overrideFilters?: typeof DEFAULT_REPORT_FILTERS) => {
      const filters = overrideFilters ?? reportFilters;

      return catalogService.generateReportSync(tenant!.id, {
        query: filters.query.trim() || undefined,
        types: filters.types,
        categoryIds: filters.categoryIds,
        includeInactive: filters.includeInactive,
      });
    },
    onSuccess: (data) => {
      const s = data.summary;
      const valueLabel = formatCurrency(s.estimatedBaseValue) ?? 'R$ 0,00';
      toast({
        title: 'Resumo do catálogo (instantâneo)',
        description: `${s.totalItems} itens · ${s.activeItems} ativos · ${s.inactiveItems} inativos · serviços ${s.services} · produtos ${s.products} · locações ${s.rentals} · valor base estimado ${valueLabel}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível obter o resumo',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Tente novamente ou use o fluxo de CSV em segundo plano.',
        }),
        variant: 'destructive',
      });
    },
  });

  const importItemsMutation = useMutation({
    mutationFn: () =>
      catalogService.startImportJob(tenant!.id, {
        rawText: importForm.rawText,
        defaultType: importForm.defaultType,
        defaultCategoryName: importForm.defaultCategoryName.trim() || undefined,
        defaultSource: importForm.defaultSource,
        defaultTags: splitTags(importForm.defaultTags),
        syncInventory: importForm.syncInventory,
      }),
    onSuccess: async (job) => {
      setCurrentImportJobId(job.id);
      setImportOpenState(false);
      setImportForm(DEFAULT_IMPORT_FORM);
      await queryClient.invalidateQueries({ queryKey: ['catalog-async-jobs', tenant?.id] });
      toast({
        title: 'Importação enfileirada',
        description:
          'Vamos processar a planilha em segundo plano e atualizar o catalogo sem travar a operação.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao iniciar importação',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel enfileirar a importação agora.',
        }),
        variant: 'destructive',
      });
    },
  });

  return {
    tenant,
    search,
    setSearch,
    page: currentPage,
    setPage,
    totalPages,
    typeFilter,
    setTypeFilter,
    showInactive,
    setShowInactive,
    reportsOpen,
    setReportsOpen(open: boolean) {
      setReportsOpenState(open);
    },
    importOpen,
    setImportOpen(open: boolean) {
      setImportOpenState(open);
      if (!open && !isActiveJob(activeImportJob)) {
        setImportForm(DEFAULT_IMPORT_FORM);
      }
    },
    categoriesQuery,
    itemsQuery,
    jobsQuery,
    activeJobItems,
    activeReportJob,
    activeImportJob,
    filteredItems: paginatedItems,
    totalFilteredItems: filteredItems.length,
    selectedCategory,
    setSelectedCategory,
    selectedItem,
    setSelectedItem,
    deleteCategoryTarget,
    setDeleteCategoryTarget,
    deleteItemTarget,
    setDeleteItemTarget,
    createItemOpen,
    setCreateItemOpen(open: boolean) {
      setCreateItemOpen(open);
      if (!open) {
        setItemForm(DEFAULT_ITEM_FORM);
        setSelectedItem(null);
      }
    },
    createCategoryOpen,
    setCreateCategoryOpen(open: boolean) {
      setCreateCategoryOpen(open);
      if (!open) {
        setCategoryForm(DEFAULT_CATEGORY_FORM);
        setSelectedCategory(null);
      }
    },
    categoryForm,
    setCategoryForm,
    itemForm,
    setItemForm,
    reportFilters,
    setReportFilters,
    importForm,
    setImportForm,
    importPreviewCount: importForm.rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length,
    setItemBasePrice(value: string) {
      setItemForm((current) => ({
        ...current,
        basePrice: formatCurrencyInput(value),
      }));
    },
    openEditCategory(category: CatalogCategory) {
      setSelectedCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description ?? '',
        parentCategoryId: category.parentCategoryId ?? '',
      });
      setCreateCategoryOpen(true);
    },
    openEditItem(item: CatalogItem) {
      setSelectedItem(item);
      setItemForm({
        name: item.name,
        type: item.type ?? 'SERVICE',
        categoryId: item.categoryId ?? '',
        basePrice: item.basePrice == null ? '' : formatCurrencyInput(String(Math.round(item.basePrice * 100))),
        externalReference: item.externalReference ?? '',
        initialStock: '',
        description: item.description ?? '',
        tags: (item.tags ?? []).join(', '),
        source: item.source ?? 'MANUAL',
        imageUrl: item.imageUrl ?? '',
        customFields: attributesToCustomFields(item.attributes),
        variants: payloadToVariants(item.variants),
        optionGroups: payloadToOptionGroups(item.optionGroups),
      });
      setCreateItemOpen(true);
    },
    isEditingCategory: Boolean(selectedCategory),
    isEditingItem: Boolean(selectedItem && createItemOpen),
    uploadItemImageMutation,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    generateReportMutation,
    syncReportSummaryMutation,
    downloadCurrentReport() {
      generateReportMutation.mutate({
        query: search,
        types: typeFilter === 'ALL' ? [] : [typeFilter],
        categoryIds: [],
        includeInactive: showInactive,
      });
    },
    importItemsMutation,
  };
}

export type CatalogPageViewModel = ReturnType<typeof useCatalogPageViewModel>;

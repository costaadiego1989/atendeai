import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { Loader2, Plus, Trash2, Upload, X, Info, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TagInput } from '@/shared/ui/TagInput';
import { Link } from 'react-router-dom';
import { requiresInventoryControl } from '../utils/formatters';
import type { InventoryItemRecord } from '@/shared/types';

interface CatalogItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  categories: any[];
  form: {
    name: string;
    type: string;
    categoryId: string;
    basePrice: string;
    externalReference: string;
    initialStock: string;
    source: string;
    tags: string;
    description: string;
    imageUrl?: string;
    weightGrams: string;
    heightCm: string;
    widthCm: string;
    lengthCm: string;
    customFields: Array<{ id: string; key: string; value: string }>;
    variants: Array<{
      id: string;
      name: string;
      reference: string;
      price: string;
      stock: string;
      fields: Array<{ id: string; key: string; value: string }>;
    }>;
    optionGroups: Array<{
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
    }>;
  };
  onFormChange: (data: any) => void;
  onPriceChange: (value: string) => void;
  onUploadImage: (file: File) => void;
  onNewCategory: () => void;
  isUploading: boolean;
  onSubmit: () => void;
  isPending: boolean;
  /** Inventory items linked to this catalog item (by catalogItemId or externalReference). */
  linkedInventoryItems?: InventoryItemRecord[];
}

const createRowId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function CatalogItemSheet({
  open,
  onOpenChange,
  isEditing,
  categories,
  form,
  onFormChange,
  onPriceChange,
  onUploadImage,
  onNewCategory,
  isUploading,
  onSubmit,
  isPending,
  linkedInventoryItems,
}: CatalogItemSheetProps) {
  const submittingRef = useRef(false);

  // Sync ref with isPending prop to reset after mutation completes
  if (!isPending) {
    submittingRef.current = false;
  }

  const handleSubmit = () => {
    if (submittingRef.current || isPending) return;
    submittingRef.current = true;
    onSubmit();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  // SKU divergence detection: compare catalog SKUs against linked inventory items
  const skuDivergences = (() => {
    if (!linkedInventoryItems?.length || !requiresInventoryControl(form.type)) {
      return [];
    }

    const inventorySkus = new Set(linkedInventoryItems.map((item) => item.sku));
    const mismatches: Array<{ catalogSku: string; context: string }> = [];

    // Check main externalReference
    if (form.externalReference?.trim()) {
      const ref = form.externalReference.trim();
      if (!inventorySkus.has(ref)) {
        mismatches.push({ catalogSku: ref, context: 'Referência externa do item' });
      }
    }

    // Check variant references/SKUs
    for (const variant of form.variants) {
      const variantSku = variant.reference?.trim();
      if (variantSku && !inventorySkus.has(variantSku)) {
        mismatches.push({
          catalogSku: variantSku,
          context: `Variação "${variant.name || 'sem nome'}"`,
        });
      }
    }

    return mismatches;
  })();

  const updateCustomField = (
    id: string,
    patch: Partial<{ key: string; value: string }>,
  ) => {
    onFormChange({
      ...form,
      customFields: form.customFields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    });
  };

  const updateVariant = (
    id: string,
    patch: Partial<(typeof form.variants)[number]>,
  ) => {
    onFormChange({
      ...form,
      variants: form.variants.map((variant) =>
        variant.id === id ? { ...variant, ...patch } : variant,
      ),
    });
  };

  const updateVariantField = (
    variantId: string,
    fieldId: string,
    patch: Partial<{ key: string; value: string }>,
  ) => {
    onFormChange({
      ...form,
      variants: form.variants.map((variant) =>
        variant.id === variantId
          ? {
            ...variant,
            fields: variant.fields.map((field) =>
              field.id === fieldId ? { ...field, ...patch } : field,
            ),
          }
          : variant,
      ),
    });
  };

  const updateOptionGroup = (
    id: string,
    patch: Partial<(typeof form.optionGroups)[number]>,
  ) => {
    onFormChange({
      ...form,
      optionGroups: form.optionGroups.map((group) =>
        group.id === id ? { ...group, ...patch } : group,
      ),
    });
  };

  const updateOption = (
    groupId: string,
    optionId: string,
    patch: Partial<(typeof form.optionGroups)[number]['options'][number]>,
  ) => {
    onFormChange({
      ...form,
      optionGroups: form.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[720px] overflow-y-auto sm:max-w-[720px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar item' : 'Novo item'}</SheetTitle>
          <SheetDescription>
            Cadastre a oferta base, atributos livres e variações quando o produto tiver grade.
          </SheetDescription>
        </SheetHeader>

        {requiresInventoryControl(form.type) ? (
          <Alert className="mt-4 border-amber-500/35 bg-amber-500/[0.07]">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-950 dark:text-amber-100">Alinhar com o estoque</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Use a mesma referência externa e SKUs das variações que você sincroniza em{' '}
              <Link to="/app/inventory" className="font-medium text-foreground underline underline-offset-2">
                Estoque
              </Link>{' '}
              para evitar divergência entre catálogo e inventário (vínculo por SKU /
              catalogItemId).
            </AlertDescription>
          </Alert>
        ) : null}

        {skuDivergences.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Divergência de SKU detectada</AlertTitle>
            <AlertDescription className="text-xs">
              <p className="mb-1">
                Os seguintes SKUs do catálogo não foram encontrados no estoque vinculado:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {skuDivergences.map((d) => (
                  <li key={d.catalogSku}>
                    <span className="font-mono font-medium">{d.catalogSku}</span>
                    {' — '}
                    {d.context}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Corrija a referência aqui ou{' '}
                <Link to="/app/inventory" className="font-medium underline underline-offset-2">
                  sincronize no Estoque
                </Link>{' '}
                para manter o vínculo.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="basic" className="mt-6 space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-lg bg-muted/50 p-1">
            <TabsTrigger value="basic" className="h-9 text-xs">Base</TabsTrigger>
            <TabsTrigger value="attributes" className="h-9 text-xs">Campos</TabsTrigger>
            <TabsTrigger value="variants" className="h-9 text-xs">Variações</TabsTrigger>
            <TabsTrigger value="options" className="h-9 text-xs">Opções</TabsTrigger>
            <TabsTrigger value="media" className="h-9 text-xs">Mídia</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="m-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome do item</Label>
                <Input
                  value={form.name}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                  placeholder="Ex: Camiseta dry fit"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => onFormChange({ ...form, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">Serviço</SelectItem>
                    <SelectItem value="PRODUCT">Produto</SelectItem>
                    <SelectItem value="RENTAL">Locação</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {requiresInventoryControl(form.type)
                    ? 'Use variações quando tamanho, cor, SKU ou estoque mudarem por opção.'
                    : 'serviços podem usar campos customizados para duração, modalidade e regras.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(value) =>
                    onFormChange({ ...form, categoryId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {Array.isArray(category.path) && category.path.length > 0
                          ? category.path.join(' / ')
                          : category.name}
                      </SelectItem>
                    ))}
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={onNewCategory}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Criar categoria
                      </Button>
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preço base</Label>
                <Input
                  value={form.basePrice}
                  onChange={(event) => onPriceChange(event.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Referência externa</Label>
                <Input
                  value={form.externalReference}
                  onChange={(event) =>
                    onFormChange({ ...form, externalReference: event.target.value })
                  }
                  placeholder="SKU ou codigo interno"
                />
              </div>

              {requiresInventoryControl(form.type) && form.variants.length === 0 ? (
                <div className="space-y-2">
                  <Label>Estoque inicial</Label>
                  <Input
                    value={form.initialStock}
                    onChange={(event) =>
                      onFormChange({ ...form, initialStock: event.target.value })
                    }
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para criar o item de estoque quando não houver variações.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={form.source}
                  onValueChange={(value) => onFormChange({ ...form, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                    <SelectItem value="IMPORT">Importado</SelectItem>
                    <SelectItem value="ERP_SNAPSHOT">ERP snapshot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {requiresInventoryControl(form.type) ? (
                <div className="space-y-3 sm:col-span-2">
                  <Label className="text-sm font-medium">Peso e dimensões (para frete por transportadora)</Label>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Peso (g)</Label>
                      <Input
                        value={form.weightGrams}
                        onChange={(event) =>
                          onFormChange({ ...form, weightGrams: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Ex: 300"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
                      <Input
                        value={form.heightCm}
                        onChange={(event) =>
                          onFormChange({ ...form, heightCm: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Largura (cm)</Label>
                      <Input
                        value={form.widthCm}
                        onChange={(event) =>
                          onFormChange({ ...form, widthCm: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Ex: 15"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comprimento (cm)</Label>
                      <Input
                        value={form.lengthCm}
                        onChange={(event) =>
                          onFormChange({ ...form, lengthCm: event.target.value.replace(/\D/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Ex: 20"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado para cotação de frete via Melhor Envio. Se vazio, usamos padrão (300g, 5x15x20cm).
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput
                  tags={form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []}
                  onChange={(tags) =>
                    onFormChange({
                      ...form,
                      tags: Array.isArray(tags) ? tags.join(', ') : tags,
                    })
                  }
                  placeholder="Ex: premium, verao, pronta-entrega"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Descrição comercial</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    onFormChange({ ...form, description: event.target.value })
                  }
                  placeholder="Contexto que a IA e o time comercial podem usar para vender melhor."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="m-0 space-y-4">
            {form.customFields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nenhum campo customizado. Adicione dados como material, prazo, garantia,
                gênero, composição ou qualquer regra do seu nicho.
              </div>
            ) : null}

            {form.customFields.map((field) => (
              <div key={field.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.5fr_auto]">
                <div className="space-y-2">
                  <Label>Campo</Label>
                  <Input
                    value={field.key}
                    onChange={(event) => updateCustomField(field.id, { key: event.target.value })}
                    placeholder="Ex: material"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    value={field.value}
                    onChange={(event) =>
                      updateCustomField(field.id, { value: event.target.value })
                    }
                    placeholder="Ex: algodao peruano"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  onClick={() =>
                    onFormChange({
                      ...form,
                      customFields: form.customFields.filter((item) => item.id !== field.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onFormChange({
                  ...form,
                  customFields: [
                    ...form.customFields,
                    { id: createRowId('field'), key: '', value: '' },
                  ],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar campo
            </Button>
          </TabsContent>

          <TabsContent value="variants" className="m-0 space-y-4">
            {form.variants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Cadastre variações quando o mesmo produto tiver opções com preço, saldo ou
                características diferentes. Se não houver opções, o preço base já resolve.
              </div>
            ) : null}

            {form.variants.map((variant, index) => (
              <div key={variant.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Variação {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onFormChange({
                        ...form,
                        variants: form.variants.filter((item) => item.id !== variant.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da variação</Label>
                    <Input
                      value={variant.name}
                      onChange={(event) => updateVariant(variant.id, { name: event.target.value })}
                      placeholder="Ex: Opcao premium, 220V, 500ml"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>referência</Label>
                    <Input
                      value={variant.reference}
                      onChange={(event) =>
                        updateVariant(variant.id, { reference: event.target.value })
                      }
                      placeholder="SKU, codigo ou identificador interno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>preço</Label>
                    <Input
                      value={variant.price}
                      onChange={(event) => updateVariant(variant.id, { price: event.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estoque</Label>
                    <Input
                      value={variant.stock}
                      onChange={(event) => updateVariant(variant.id, { stock: event.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Caracteristicas livres</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateVariant(variant.id, {
                          fields: [
                            ...variant.fields,
                            { id: createRowId('variant-field'), key: '', value: '' },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Campo
                    </Button>
                  </div>

                  {variant.fields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                      Adicione pares livres como voltagem/220V, sabor/baunilha,
                      capacidade/2L, duracao/60min ou qualquer atributo do produto.
                    </div>
                  ) : null}

                  {variant.fields.map((field) => (
                    <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                      <Input
                        value={field.key}
                        onChange={(event) =>
                          updateVariantField(variant.id, field.id, { key: event.target.value })
                        }
                        placeholder="Atributo"
                      />
                      <Input
                        value={field.value}
                        onChange={(event) =>
                          updateVariantField(variant.id, field.id, { value: event.target.value })
                        }
                        placeholder="Valor"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateVariant(variant.id, {
                            fields: variant.fields.filter((item) => item.id !== field.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onFormChange({
                  ...form,
                  variants: [
                    ...form.variants,
                    {
                      id: createRowId('variant'),
                      name: '',
                      reference: '',
                      price: '',
                      stock: '',
                      fields: [{ id: createRowId('variant-field'), key: '', value: '' }],
                    },
                  ],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar variação
            </Button>
          </TabsContent>

          <TabsContent value="options" className="m-0 space-y-4">
            {form.optionGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Crie grupos de escolha para delivery e alimentos, como tamanho,
                adicionais, acompanhamentos ou ponto da carne. Cada grupo pode ser
                obrigatorio ou opcional.
              </div>
            ) : null}

            {form.optionGroups.map((group, groupIndex) => (
              <div key={group.id} className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Grupo {groupIndex + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      Regras de escolha exibidas na venda do item.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onFormChange({
                        ...form,
                        optionGroups: form.optionGroups.filter((item) => item.id !== group.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div className="space-y-2">
                    <Label>Nome do grupo</Label>
                    <Input
                      value={group.name}
                      onChange={(event) => updateOptionGroup(group.id, { name: event.target.value })}
                      placeholder="Ex: Adicionais, Acompanhamentos, Tamanho"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mín.</Label>
                    <Input
                      className="w-20"
                      value={group.min}
                      onChange={(event) => updateOptionGroup(group.id, { min: event.target.value })}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx.</Label>
                    <Input
                      className="w-20"
                      value={group.max}
                      onChange={(event) => updateOptionGroup(group.id, { max: event.target.value })}
                      inputMode="numeric"
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Obrigatório</Label>
                    <div className="flex h-10 items-center gap-2">
                      <Switch
                        checked={group.required}
                        onCheckedChange={(checked) =>
                          updateOptionGroup(group.id, {
                            required: checked,
                            min: checked && Number(group.min || 0) === 0 ? '1' : group.min,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Opções</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateOptionGroup(group.id, {
                          options: [
                            ...group.options,
                            {
                              id: createRowId('option'),
                              name: '',
                              priceDelta: '',
                              sku: '',
                              active: true,
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Opção
                    </Button>
                  </div>

                  {group.options.map((option) => (
                    <div key={option.id} className="grid gap-3 rounded-md bg-muted/20 p-3 sm:grid-cols-[1fr_120px_1fr_auto]">
                      <Input
                        value={option.name}
                        onChange={(event) => updateOption(group.id, option.id, { name: event.target.value })}
                        placeholder="Ex: Bacon, Batata frita, 500ml"
                      />
                      <Input
                        value={option.priceDelta}
                        onChange={(event) =>
                          updateOption(group.id, option.id, { priceDelta: event.target.value })
                        }
                        placeholder="+0,00"
                      />
                      <Input
                        value={option.sku}
                        onChange={(event) => updateOption(group.id, option.id, { sku: event.target.value })}
                        placeholder="SKU opcional"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateOptionGroup(group.id, {
                            options: group.options.filter((item) => item.id !== option.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onFormChange({
                  ...form,
                  optionGroups: [
                    ...form.optionGroups,
                    {
                      id: createRowId('option-group'),
                      name: '',
                      required: false,
                      min: '0',
                      max: '1',
                      options: [
                        {
                          id: createRowId('option'),
                          name: '',
                          priceDelta: '',
                          sku: '',
                          active: true,
                        },
                      ],
                    },
                  ],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar grupo de opções
            </Button>
          </TabsContent>

          <TabsContent value="media" className="m-0">
            <div className="space-y-3">
              <Label>Imagem do item</Label>
              <div className="flex flex-col gap-4">
                {form.imageUrl ? (
                  <div className="group relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onFormChange({ ...form, imageUrl: '' })}
                        type="button"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remover imagem
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:bg-muted/50"
                    onClick={() => document.getElementById('catalog-item-image')?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium">Clique para fazer upload</p>
                        <p className="mt-1 px-4 text-center text-xs text-muted-foreground">
                          PNG, JPG ou WEBP. Recomendado 1200x675px.
                        </p>
                      </>
                    )}
                  </button>
                )}
                <input
                  id="catalog-item-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending ? 'Salvando...' : isEditing ? 'Salvar ajustes' : 'Criar item'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

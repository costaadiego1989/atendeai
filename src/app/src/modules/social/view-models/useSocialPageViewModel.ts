import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { useAuthStore } from '@/shared/stores/auth-store';
import { socialService } from '../services/social.service';
import type { CreateSocialRuleInput, SocialRuleActions } from '../services/types';

const DEFAULT_RULE_FORM: CreateSocialRuleInput = {
  name: '',
  platform: 'INSTAGRAM',
  priority: 10,
  conditions: { keywords: [], excludeKeywords: [] },
  actions: {
    replyToComment: {
      enabled: true,
      mode: 'AI_GENERATED',
      aiPrompt: 'Responda de forma amigável e objetiva. Convide para DM quando necessário.',
      templates: [],
    },
    sendInboxMessage: {
      enabled: true,
      delaySeconds: 25,
      mode: 'TEMPLATE',
      templates: ['Olá! Vi seu comentário e posso te ajudar por aqui no direct 😊'],
      aiPrompt: '',
    },
  },
  limits: {
    maxRepliesPerPost: 50,
    maxRepliesPerHour: 30,
    cooldownPerUser: 60,
  },
};

export function useSocialPageViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((state) => state.tenant);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'comments' | 'rules' | 'agent' | 'accounts'>('comments');
  const [isConnecting, setIsConnecting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [newRuleForm, setNewRuleForm] = useState<CreateSocialRuleInput>(DEFAULT_RULE_FORM);
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

  useEffect(() => {
    const connected = searchParams.get('instagram_connected');
    const error = searchParams.get('instagram_error');

    if (connected === 'true') {
      toast({ title: 'Instagram conectado', description: 'Conta Instagram Business vinculada com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['social-accounts', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['social-stats', tenant?.id] });
      setActiveTab('accounts');
      setSearchParams({}, { replace: true });
    } else if (error) {
      const messages: Record<string, string> = {
        no_instagram_account: 'Nenhuma conta Instagram Business encontrada. Verifique se a página do Facebook está vinculada a uma conta comercial do Instagram.',
        access_denied: 'Permissão negada pelo usuário.',
        token_exchange_failed: 'Falha ao obter token de acesso. Tente novamente.',
        pages_fetch_failed: 'Não foi possível buscar as páginas do Facebook.',
        account_info_failed: 'Não foi possível obter os dados da conta Instagram.',
        connect_failed: 'Falha ao conectar a conta. Tente novamente.',
      };
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar Instagram',
        description: messages[error] ?? 'Ocorreu um erro inesperado. Tente novamente.',
      });
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statsQuery = useQuery({
    queryKey: ['social-stats', tenant?.id],
    queryFn: () => socialService.getStats(tenant!.id),
    enabled: !!tenant?.id,
  });

  const accountsQuery = useQuery({
    queryKey: ['social-accounts', tenant?.id],
    queryFn: () => socialService.listAccounts(tenant!.id),
    enabled: !!tenant?.id && activeTab === 'accounts',
  });

  const commentsQuery = useQuery({
    queryKey: ['social-comments', tenant?.id, 'PENDING'],
    queryFn: () => socialService.listComments(tenant!.id),
    enabled: !!tenant?.id && activeTab === 'comments',
  });

  const commentThreadQuery = useQuery({
    queryKey: ['social-comment-thread', tenant?.id, selectedCommentId],
    queryFn: () => socialService.getCommentThread(tenant!.id, selectedCommentId!),
    enabled: !!tenant?.id && !!selectedCommentId && activeTab === 'comments',
  });

  const rulesQuery = useQuery({
    queryKey: ['social-rules', tenant?.id],
    queryFn: () => socialService.listRules(tenant!.id),
    enabled: !!tenant?.id && activeTab === 'rules',
  });

  const disconnectAccountMutation = useMutation({
    mutationFn: (accountId: string) => socialService.disconnectAccount(tenant!.id, accountId),
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Conta desconectada com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['social-accounts', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['social-stats', tenant?.id] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: getFriendlyErrorMessage(error),
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (ruleId: string) => socialService.toggleRule(tenant!.id, ruleId),
    onSuccess: () => {
      toast({ title: 'Status atualizado' });
      queryClient.invalidateQueries({ queryKey: ['social-rules', tenant?.id] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao alterar regra',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível alterar o status da regra.',
        }),
      });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: CreateSocialRuleInput) => socialService.createRule(tenant!.id, payload),
    onSuccess: () => {
      toast({ title: 'Regra criada', description: 'A automação já está pronta para disparar.' });
      setNewRuleOpen(false);
      setNewRuleForm(DEFAULT_RULE_FORM);
      setKeywordInput('');
      setExcludeKeywordInput('');
      queryClient.invalidateQueries({ queryKey: ['social-rules', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['social-stats', tenant?.id] });
      setActiveTab('rules');
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao criar regra',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possível salvar a regra agora.',
        }),
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (payload: { commentId: string; text: string }) =>
      socialService.replyToComment(tenant!.id, payload.commentId, payload.text),
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Falha ao responder',
          description: result.error || 'não foi possível enviar a resposta.',
        });
        return;
      }
      setReplyDraft('');
      toast({ title: 'Resposta enviada' });
      queryClient.invalidateQueries({ queryKey: ['social-comments', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['social-comment-thread', tenant?.id, selectedCommentId] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao responder',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Não foi possível enviar a resposta ao comentário.',
        }),
      });
    },
  });

  const selectedComment = useMemo(
    () => commentsQuery.data?.data.find((item) => item.id === selectedCommentId) ?? null,
    [commentsQuery.data?.data, selectedCommentId],
  );

  const connectionStatus = useMemo(() => {
    if (accountsQuery.isLoading) return 'loading';
    if (!accountsQuery.data?.length) return 'disconnected';
    return accountsQuery.data.some((acc) => acc.status === 'ACTIVE') ? 'connected' : 'degraded';
  }, [accountsQuery.data, accountsQuery.isLoading]);

  const updateRuleActionMode = (
    key: keyof SocialRuleActions,
    mode: 'AI_GENERATED' | 'TEMPLATE',
  ) => {
    setNewRuleForm((current) => ({
      ...current,
      actions: {
        ...current.actions,
        [key]: {
          ...current.actions[key],
          mode,
        },
      },
    }));
  };

  return {
    state: {
      activeTab,
      settingsOpen,
      newRuleOpen,
      selectedCommentId,
      selectedComment,
      replyDraft,
      stats: statsQuery.data,
      isStatsLoading: statsQuery.isLoading,
      accounts: accountsQuery.data || [],
      isAccountsLoading: accountsQuery.isLoading,
      comments: commentsQuery.data?.data || [],
      commentsTotal: commentsQuery.data?.total || 0,
      isCommentsLoading: commentsQuery.isLoading,
      commentThread: commentThreadQuery.data,
      isCommentThreadLoading: commentThreadQuery.isLoading,
      rules: rulesQuery.data || [],
      isRulesLoading: rulesQuery.isLoading,
      newRuleForm,
      keywordInput,
      excludeKeywordInput,
      connectionStatus,
      isConnecting,
      createRuleMutation,
      replyMutation,
      canSubmitRule: Boolean(newRuleForm.name.trim() && newRuleForm.conditions.keywords?.length),
    },
    actions: {
      setActiveTab,
      setSettingsOpen,
      setNewRuleOpen,
      setSelectedCommentId,
      setReplyDraft,
      disconnectAccount: disconnectAccountMutation.mutate,
      toggleRule: toggleRuleMutation.mutate,
      setNewRuleForm,
      setKeywordInput,
      setExcludeKeywordInput,
      updateRuleActionMode,
      addKeyword() {
        const value = keywordInput.trim();
        if (!value) return;
        setNewRuleForm((current) => ({
          ...current,
          conditions: {
            ...current.conditions,
            keywords: Array.from(new Set([...(current.conditions.keywords ?? []), value])),
          },
        }));
        setKeywordInput('');
      },
      removeKeyword(keyword: string) {
        setNewRuleForm((current) => ({
          ...current,
          conditions: {
            ...current.conditions,
            keywords: (current.conditions.keywords ?? []).filter((item) => item !== keyword),
          },
        }));
      },
      addExcludeKeyword() {
        const value = excludeKeywordInput.trim();
        if (!value) return;
        setNewRuleForm((current) => ({
          ...current,
          conditions: {
            ...current.conditions,
            excludeKeywords: Array.from(
              new Set([...(current.conditions.excludeKeywords ?? []), value]),
            ),
          },
        }));
        setExcludeKeywordInput('');
      },
      removeExcludeKeyword(keyword: string) {
        setNewRuleForm((current) => ({
          ...current,
          conditions: {
            ...current.conditions,
            excludeKeywords: (current.conditions.excludeKeywords ?? []).filter(
              (item) => item !== keyword,
            ),
          },
        }));
      },
      submitRule() {
        createRuleMutation.mutate(newRuleForm);
      },
      submitReply() {
        if (!selectedCommentId || !replyDraft.trim()) return;
        replyMutation.mutate({ commentId: selectedCommentId, text: replyDraft.trim() });
      },
      async connectInstagramOAuth() {
        if (!tenant?.id) return;
        setIsConnecting(true);
        try {
          const { authUrl } = await socialService.getInstagramOAuthUrl(tenant.id);
          window.location.href = authUrl;
        } catch (err) {
          setIsConnecting(false);
          toast({
            variant: 'destructive',
            title: 'Erro ao iniciar conexão',
            description: getFriendlyErrorMessage(err),
          });
        }
      },
    },
  };
}

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Loader2, MessageCircle, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { useWidgetSettingsViewModel } from '../view-models/useWidgetSettingsViewModel';
import { WidgetPreview } from '../components/WidgetPreview';
import { WidgetEmbedSnippet } from '../components/WidgetEmbedSnippet';

const widgetSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  enabled: z.boolean(),
  greeting: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').optional(),
  backgroundColor: z.string().optional(),
  position: z.enum(['bottom-right', 'bottom-left']),
  collectName: z.boolean(),
  collectPhone: z.boolean(),
  collectEmail: z.boolean(),
  collectCpf: z.boolean(),
  proactiveDelay: z.coerce.number().min(0).optional(),
  proactiveMsg: z.string().optional(),
});

type WidgetFormValues = z.infer<typeof widgetSchema>;

export function WidgetSettingsPage() {
  const vm = useWidgetSettingsViewModel();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await vm.uploadAvatar(file);
    e.target.value = '';
  };

  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetSchema),
    defaultValues: {
      name: '',
      enabled: true,
      greeting: '',
      color: '#3b82f6',
      backgroundColor: '',
      position: 'bottom-right',
      collectName: true,
      collectPhone: false,
      collectEmail: true,
      collectCpf: false,
      proactiveDelay: 5000,
      proactiveMsg: '',
    },
  });

  useEffect(() => {
    if (vm.config) {
      form.reset({
        name: vm.config.name,
        enabled: vm.config.enabled,
        greeting: vm.config.greeting ?? '',
        color: vm.config.color ?? '#3b82f6',
        backgroundColor: vm.config.backgroundColor ?? '',
        position: vm.config.position,
        collectName: vm.config.collectName,
        collectPhone: vm.config.collectPhone,
        collectEmail: vm.config.collectEmail,
        collectCpf: vm.config.collectCpf,
        proactiveDelay: vm.config.proactiveDelay ?? 5000,
        proactiveMsg: vm.config.proactiveMsg ?? '',
      });
    }
  }, [vm.config, form]);

  const watchedValues = form.watch();

  const handleSubmit = form.handleSubmit(async (values) => {
    await vm.saveConfig({
      name: values.name,
      enabled: values.enabled,
      greeting: values.greeting || null,
      color: values.color || null,
      backgroundColor: values.backgroundColor || null,
      position: values.position,
      collectName: values.collectName,
      collectPhone: values.collectPhone,
      collectEmail: values.collectEmail,
      collectCpf: values.collectCpf,
      proactiveDelay: values.proactiveDelay || null,
      proactiveMsg: values.proactiveMsg || null,
    });
  });

  if (vm.isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Widget Chat</h1>
        </div>
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Widget Chat
        </h1>
        <p className="page-description">
          Configure o widget de chat que será instalado no site do seu negócio.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Config column */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Widget ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Desative para esconder o widget do site.
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.enabled}
                    onCheckedChange={(v) => form.setValue('enabled', v, { shouldDirty: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input placeholder="Meu Widget" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Saudação</Label>
                  <Textarea
                    rows={2}
                    placeholder="Olá! Como posso ajudar?"
                    {...form.register('greeting')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Avatar do agente</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border overflow-hidden bg-muted/30">
                      {vm.config?.avatarUrl ? (
                        <img
                          src={vm.config.avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Bot className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                        disabled={vm.isUploadingAvatar}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={vm.isUploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        className="h-8 gap-2"
                      >
                        {vm.isUploadingAvatar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        {vm.isUploadingAvatar ? 'Enviando...' : 'Enviar imagem'}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">JPG, PNG, GIF ou WebP</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cor de fundo das mensagens</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded border border-border"
                      value={watchedValues.backgroundColor || '#ffffff'}
                      onChange={(e) => form.setValue('backgroundColor', e.target.value, { shouldDirty: true })}
                    />
                    <Input className="flex-1" placeholder="#ffffff" {...form.register('backgroundColor')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-8 w-8 cursor-pointer rounded border border-border"
                        value={watchedValues.color || '#3b82f6'}
                        onChange={(e) => form.setValue('color', e.target.value, { shouldDirty: true })}
                      />
                      <Input className="flex-1" {...form.register('color')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Posição</Label>
                    <Select
                      value={watchedValues.position}
                      onValueChange={(v) =>
                        form.setValue('position', v as 'bottom-right' | 'bottom-left', { shouldDirty: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Inferior direito</SelectItem>
                        <SelectItem value="bottom-left">Inferior esquerdo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Coletar nome do visitante</Label>
                  <Switch
                    checked={watchedValues.collectName}
                    onCheckedChange={(v) => form.setValue('collectName', v, { shouldDirty: true })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Coletar telefone</Label>
                  <Switch
                    checked={watchedValues.collectPhone}
                    onCheckedChange={(v) => form.setValue('collectPhone', v, { shouldDirty: true })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Coletar e-mail</Label>
                  <Switch
                    checked={watchedValues.collectEmail}
                    onCheckedChange={(v) => form.setValue('collectEmail', v, { shouldDirty: true })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Coletar CPF</Label>
                    <p className="text-xs text-muted-foreground">Opcional — visitante pode pular.</p>
                  </div>
                  <Switch
                    checked={watchedValues.collectCpf}
                    onCheckedChange={(v) => form.setValue('collectCpf', v, { shouldDirty: true })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Mensagem proativa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Delay (ms)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    {...form.register('proactiveDelay')}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tempo em milissegundos antes de exibir a mensagem proativa. 0 = desativado.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    rows={2}
                    placeholder="Precisa de ajuda? Estou aqui!"
                    {...form.register('proactiveMsg')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview + Embed column */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <WidgetPreview
                  name={watchedValues.name}
                  greeting={watchedValues.greeting}
                  color={watchedValues.color}
                  backgroundColor={watchedValues.backgroundColor}
                  avatarUrl={vm.config?.avatarUrl}
                  position={watchedValues.position}
                />
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Instalação</CardTitle>
              </CardHeader>
              <CardContent>
                <WidgetEmbedSnippet snippet={vm.embedSnippet} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={vm.isSaving || !form.formState.isDirty}>
            {vm.isSaving ? 'Salvando...' : 'Salvar widget'}
          </Button>
        </div>
      </form>
    </div>
  );
}

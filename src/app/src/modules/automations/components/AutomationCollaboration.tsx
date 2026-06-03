import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Share2, 
  Users, 
  Eye, 
  Edit, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  UserPlus,
  Mail,
  Calendar,
  MessageSquare,
  Settings,
  Shield,
} from 'lucide-react';
import { Automation } from '../types';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

interface SharePermission {
  userId: string;
  permission: 'view' | 'edit';
  grantedAt: string;
  grantedBy: string;
}

interface AutomationCollaboration {
  automationId: string;
  sharedWith: SharePermission[];
  pendingRequests: Array<{
    id: string;
    requestedBy: {
      id: string;
      name: string;
      email: string;
    };
    requestedAt: string;
    message?: string;
  }>;
  isShared: boolean;
  shareSettings: {
    allowView: boolean;
    allowEdit: boolean;
    requireApproval: boolean;
  };
}

interface AutomationCollaborationProps {
  automation: Automation;
  onPermissionUpdate?: (permissions: SharePermission[]) => void;
  onShareRequest?: (requestId: string, approved: boolean) => void;
  currentUserId?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  automation: Automation;
  currentMembers: SharePermission[];
  onShare: (emails: string[], permissions: 'view' | 'edit') => void;
}

interface PendingRequestProps {
  request: AutomationCollaboration['pendingRequests'][0];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

function PermissionBadge({ permission }: { permission: string }) {
  const variants = {
    view: 'secondary',
    edit: 'default',
  };

  const labels = {
    view: 'Apenas visualização',
    edit: 'Edição',
  };

  return (
    <Badge variant={variants[permission as keyof typeof variants] as any}>
      {labels[permission as keyof typeof labels]}
    </Badge>
  );
}

function ShareModal({ isOpen, onOpenChange, automation, currentMembers, onShare }: ShareModalProps) {
  const [emails, setEmails] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const emailList = emails.split(',').map(email => email.trim()).filter(email => email);
      await onShare(emailList, permission);
      setEmails('');
      onOpenChange(false);
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Compartilhar Automação
            </CardTitle>
            <CardDescription>
              Convide membros da equipe para colaborar nesta automação
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Emails dos colaboradores</label>
              <Input
                placeholder="Digite os emails separados por vírgula"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ex: joao@empresa.com, maria@empresa.com
              </p>
            </div>

            {/* Permission Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Permissão</label>
              <Select value={permission} onValueChange={(value: 'view' | 'edit') => setPermission(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Apenas visualização
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Edição completa
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Current Members Preview */}
            {currentMembers.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Membros atuais</label>
                <div className="space-y-2">
                  {currentMembers.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {member.userId.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{member.userId}</span>
                      </div>
                      <PermissionBadge permission={member.permission} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleShare} 
                disabled={isSharing || !emails.trim()}
                className="flex-1"
              >
                {isSharing ? 'Compartilhando...' : 'Compartilhar'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PendingRequest({ request, onApprove, onReject }: PendingRequestProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (approved: boolean) => {
    setIsProcessing(true);
    try {
      if (approved) {
        await onApprove(request.id);
      } else {
        await onReject(request.id);
      }
    } catch (error) {
      console.error('Request action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {request.requestedBy.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{request.requestedBy.name}</span>
                <Badge variant="outline" className="text-xs">
                  {request.requestedBy.email}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Solicitado em {new Date(request.requestedAt).toLocaleDateString('pt-BR')}
              </p>
              {request.message && (
                <p className="text-sm text-muted-foreground italic">
                  "{request.message}"
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(false)}
              disabled={isProcessing}
              className="text-destructive hover:text-destructive"
            >
              {isProcessing ? 'Processando...' : 'Recusar'}
            </Button>
            <Button
              size="sm"
              onClick={() => handleAction(true)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processando...' : 'Aprovar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mock data generators
function generateMockCollaboration(automation: Automation): AutomationCollaboration {
  return {
    automationId: automation.id,
    sharedWith: [
      {
        userId: 'user-2',
        permission: 'edit',
        grantedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        grantedBy: 'user-1',
      },
      {
        userId: 'user-3',
        permission: 'view',
        grantedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        grantedBy: 'user-1',
      },
    ],
    pendingRequests: [
      {
        id: 'request-1',
        requestedBy: {
          id: 'user-4',
          name: 'Pedro Oliveira',
          email: 'pedro@empresa.com',
        },
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Preciso editar esta automação para incluir novos passos.',
      },
    ],
    isShared: true,
    shareSettings: {
      allowView: true,
      allowEdit: true,
      requireApproval: true,
    },
  };
}

function generateMockTeamMembers(): TeamMember[] {
  return [
    {
      id: 'user-1',
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'owner',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-2',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'editor',
      joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-3',
      name: 'Ana Costa',
      email: 'ana@empresa.com',
      role: 'viewer',
      joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export function AutomationCollaboration({
  automation,
  onPermissionUpdate,
  onShareRequest,
  currentUserId = 'user-1',
}: AutomationCollaborationProps) {
  const [collaboration, setCollaboration] = useState<AutomationCollaboration | null>(null);
  const [teamMembers] = useState<TeamMember[]>(generateMockTeamMembers());
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    // In a real app, this would fetch from an API
    setCollaboration(generateMockCollaboration(automation));
  }, [automation.id]);

  const handleShare = async (emails: string[], permission: 'view' | 'edit') => {
    // Mock share functionality
    const newPermissions: SharePermission[] = emails.map(email => ({
      userId: email,
      permission,
      grantedAt: new Date().toISOString(),
      grantedBy: currentUserId,
    }));

    const updatedCollaboration = {
      ...collaboration!,
      sharedWith: [...collaboration!.sharedWith, ...newPermissions],
      isShared: true,
    };

    setCollaboration(updatedCollaboration);
    onPermissionUpdate?.(updatedCollaboration.sharedWith);
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!collaboration) return;

    const updatedRequests = collaboration.pendingRequests.filter(req => req.id !== requestId);
    const updatedCollaboration = {
      ...collaboration,
      pendingRequests: updatedRequests,
    };

    setCollaboration(updatedCollaboration);
    onShareRequest?.(requestId, true);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!collaboration) return;

    const updatedRequests = collaboration.pendingRequests.filter(req => req.id !== requestId);
    const updatedCollaboration = {
      ...collaboration,
      pendingRequests: updatedRequests,
    };

    setCollaboration(updatedCollaboration);
    onShareRequest?.(requestId, false);
  };

  if (!collaboration) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando dados de colaboração...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentUserPermission = collaboration.sharedWith.find(p => p.userId === currentUserId);
  const isOwner = currentUserPermission?.permission === 'edit' || teamMembers.find(m => m.id === currentUserId)?.role === 'owner';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Colaboração
          </h3>
          <p className="text-sm text-muted-foreground">
            {collaboration.isShared ? 'Automação compartilhada' : 'Automação privada'}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowShareModal(true)}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
        )}
      </div>

      {/* Share Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {collaboration.isShared ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              <span className="font-medium">
                {collaboration.isShared ? 'Compartilhada com' : 'Não compartilhada'}
              </span>
            </div>
            <Badge variant={collaboration.isShared ? 'default' : 'secondary'}>
              {collaboration.sharedWith.length} membros
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Shared Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros com Acesso</CardTitle>
          <CardDescription>
            Quais usuários podem acessar esta automação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {collaboration.sharedWith.map((permission) => {
                const member = teamMembers.find(m => m.id === permission.userId);
                return (
                  <div key={permission.userId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {member?.name.slice(0, 2).toUpperCase() || permission.userId.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member?.name || permission.userId}</p>
                        <p className="text-xs text-muted-foreground">{member?.email}</p>
                      </div>
                    </div>
                    <PermissionBadge permission={permission.permission} />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {collaboration.pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Solicitações Pendentes
            </CardTitle>
            <CardDescription>
              {collaboration.pendingRequests.length} solicitação(s) aguardando aprovação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {collaboration.pendingRequests.map((request) => (
                <PendingRequest
                  key={request.id}
                  request={request}
                  onApprove={handleApproveRequest}
                  onReject={handleRejectRequest}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onOpenChange={setShowShareModal}
        automation={automation}
        currentMembers={collaboration.sharedWith}
        onShare={handleShare}
      />
    </div>
  );
}
import type { BusinessType } from '@/shared/types';

export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
  description: string;
}

export const businessTypeOptions: BusinessTypeOption[] = [
  {
    value: 'RETAIL',
    label: 'Varejo',
    description: 'Lojas, mercados e operações guiadas por catalogo e estoque.',
  },
  {
    value: 'ECOMMERCE',
    label: 'E-commerce',
    description: 'Venda por catalogo, carrinho, entrega e pagamento conversacional.',
  },
  {
    value: 'HEALTH',
    label: 'Clínicas & Saúde',
    description: 'Operações com categorias, profissionais e agenda especializada.',
  },
  {
    value: 'BEAUTY',
    label: 'Beleza & Estética',
    description: 'Barbearias, estética e atendimentos por horário.',
  },
  {
    value: 'LEGAL',
    label: 'Advocacia & Consultores',
    description: 'Escritórios de advocacia e consultoria profissional.',
  },
  {
    value: 'REALESTATE',
    label: 'Imobiliárias',
    description: 'Venda e locação de imóveis com catálogo dinâmico.',
  },
  {
    value: 'FOOD',
    label: 'Restaurantes & Delivery',
    description: 'Alimentação com pedido imediato, cozinha e entrega.',
  },
  {
    value: 'AGENCY',
    label: 'Agências',
    description: 'Prestação de serviços criativos e consultoria.',
  },
  {
    value: 'GYM',
    label: 'Academias & Studios',
    description: 'Gestão de membros e horários de treino.',
  },
  {
    value: 'EDUCATION',
    label: 'Escolas & Cursos',
    description: 'Instituições de ensino e venda de infoprodutos.',
  },
  {
    value: 'PET',
    label: 'Petshops & Vets',
    description: 'Serviços e produtos para animais de estimação.',
  },
  {
    value: 'AUTOMOTIVE',
    label: 'Automotivo',
    description: 'Oficinas e venda de veículos ou peças.',
  },
  {
    value: 'HOME_SERV',
    label: 'Serviços Residenciais',
    description: 'Reformas, limpeza e manutenção doméstica.',
  },
  {
    value: 'HOSPITALITY',
    label: 'Hotelaria',
    description: 'Reservas de estadias e serviços de turismo.',
  },
  {
    value: 'SUPERMARKET',
    label: 'Supermercado',
    description: 'Compra assistida com estoque, itens relacionados, frete e retirada.',
  },
  {
    value: 'MARKET',
    label: 'Mercado',
    description: 'Fluxo transacional para itens do dia a dia com pedido no WhatsApp.',
  },
  {
    value: 'GROCERY',
    label: 'Mercearia',
    description: 'Catalogo enxuto, estoque e carrinho assistido por conversa.',
  },
  {
    value: 'BAKERY',
    label: 'Padaria',
    description: 'Pedidos rapidos com retirada ou entrega e taxa de frete configuravel.',
  },
  {
    value: 'CAFETERIA',
    label: 'Cafeteria',
    description: 'Venda de produtos com complemento de itens antes do checkout.',
  },
  {
    value: 'SIMPLE_SERVICE',
    label: 'Serviço simples',
    description: 'Negócios consultivos sem agenda estruturada.',
  },
  {
    value: 'SCHEDULING',
    label: 'Serviço com agenda',
    description: 'Atendimentos agendados por horário.',
  },
  {
    value: 'CLINIC',
    label: 'Clinica',
    description: 'Clínicas com agenda especializada.',
  },
  {
    value: 'RECOVERY',
    label: 'Recovery',
    description: 'Comunicação de cobrança, carteira e negociação.',
  },
  {
    value: 'RENTAL',
    label: 'Locação',
    description: 'Catalogo com disponibilidade por periodo e reserva.',
  },
  {
    value: 'OTHER',
    label: 'Outro',
    description: 'Fluxo inicial generico para empresas fora dos modelos padrao.',
  },
];

export function getBusinessTypeLabel(value?: string | null): string {
  return businessTypeOptions.find((option) => option.value === value)?.label ?? 'não definido';
}

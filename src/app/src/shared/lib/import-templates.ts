type ImportTemplateDefinition = {
  fileName: string;
  content: string;
};

const contactImportTemplate: ImportTemplateDefinition = {
  fileName: 'modelo-importação-contatos.csv',
  content: [
    'Nome;Telefone;Documento;Email;Tags;Observações',
    'Fernanda Costa;+55 21 99300-1884;12345678901;fernanda.costa@example.com;vip,checkout;Prefere entrega apos 18h',
    'Marcos Lima;+55 21 99211-4455;98765432100;marcos.lima@example.com;lead,instagram;Pediu catalogo de bolos',
    'Juliana Rocha;+55 21 99123-7788;45678912300;juliana.rocha@example.com;recovery,pix;Aguardando retorno sobre pagamento',
  ].join('\n'),
};

const catalogImportTemplate: ImportTemplateDefinition = {
  fileName: 'modelo-importação-catalogo.csv',
  content: [
    'nome;preço;categoria;tipo;sku;estoque;tags;descrição',
    'Cafe especial 250g;24.90;Bebidas;PRODUCT;CAF-250;18;premium,cafe;Torra media com notas achocolatadas',
    'Bolo de cenoura;48.00;Confeitaria;PRODUCT;BOLO-CEN-001;6;checkout,mais-vendido;Bolo caseiro com cobertura de chocolate',
    'Consulta inicial;120.00;serviços;SERVICE;CONS-INI-001;;agendamento;Atendimento com duração media de 45 minutos',
  ].join('\n'),
};

function downloadTemplateFile(template: ImportTemplateDefinition) {
  const blob = new Blob([template.content], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = template.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadContactsImportTemplate() {
  downloadTemplateFile(contactImportTemplate);
}

export function downloadCatalogImportTemplate() {
  downloadTemplateFile(catalogImportTemplate);
}

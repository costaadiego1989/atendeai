export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export const cepService = {
  async fetchAddress(cep: string): Promise<ViaCepResponse | null> {
    const sanitizedCep = cep.replace(/\D/g, '');
    
    if (sanitizedCep.length !== 8) {
      return null;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${sanitizedCep}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch address from ViaCEP:', error);
      return null;
    }
  },
};

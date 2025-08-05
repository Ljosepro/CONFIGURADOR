interface PayuSignatureParams {
  referenceCode: string;
  amount: string;
  currency: string;
}

export function getPayuSignature(params: PayuSignatureParams): Promise<string>; 
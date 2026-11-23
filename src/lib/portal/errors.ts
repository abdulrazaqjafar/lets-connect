export class PortalPaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PortalPaymentError";
    this.status = status;
  }
}

// The SMS provider abstraction. A thin interface so the dispatch layer stays
// gateway-agnostic — swapping Sendexa for another cheapest-for-country
// gateway later is a one-file change (a new class implementing SmsProvider +
// a factory branch). See [[project-wacli-daemon-local]] for the WhatsApp side.
export type SmsSendResult = { success: boolean; messageId?: string; reason?: string };

export interface SmsProvider {
  send(opts: { to: string; message: string; from?: string }): Promise<SmsSendResult>;
}
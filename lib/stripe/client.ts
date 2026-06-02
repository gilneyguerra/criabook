import Stripe from "stripe";

/**
 * Instância do Stripe (null se a chave ainda não estiver configurada, para
 * não quebrar build/preview). Use apenas no servidor.
 */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

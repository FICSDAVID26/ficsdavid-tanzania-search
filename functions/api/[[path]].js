import accountApi from "../_shared/account-api.js";

export async function onRequest(context) {
  return accountApi.fetch(context.request, context.env);
}

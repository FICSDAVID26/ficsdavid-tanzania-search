import accountApi from "../../src/worker.js";

export async function onRequest(context) {
  return accountApi.fetch(context.request, context.env);
}

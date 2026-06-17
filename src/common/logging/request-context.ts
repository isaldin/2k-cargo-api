import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => Promise<T>,
): Promise<T> {
  return requestContextStorage.run(context, callback);
}

export function setRequestContext(context: RequestContext): void {
  const store = requestContextStorage.getStore();
  if (store) {
    Object.assign(store, context);
  }
}

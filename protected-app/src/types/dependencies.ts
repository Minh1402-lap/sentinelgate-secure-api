export interface DatabaseHealthClient {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
}

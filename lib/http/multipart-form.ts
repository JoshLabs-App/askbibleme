/** Node/undici FormData typing differs from DOM; use this at API route boundaries. */
export type MultipartForm = {
  get(name: string): FormDataEntryValue | null;
};

export async function readMultipartForm(req: Request): Promise<MultipartForm> {
  return (await req.formData()) as unknown as MultipartForm;
}

export function readFormString(form: MultipartForm, name: string): string {
  return String(form.get(name) ?? "").trim();
}

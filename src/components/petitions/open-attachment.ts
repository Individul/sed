import { toast } from "sonner";
import { getAttachmentUrl } from "@/app/petitii/attachment-actions";

/**
 * Deschide fișierul într-o filă nouă.
 *
 * Fila se deschide sincron, în gestul utilizatorului: linkul semnat vine abia
 * după un await, iar un `window.open` de acolo ar fi blocat ca pop-up.
 */
export async function openAttachment(path: string): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null; // fără acces înapoi la fereastra noastră
  const { url, error } = await getAttachmentUrl(path);
  if (error || !url) {
    tab?.close();
    toast.error(error ?? "Nu s-a putut deschide fișierul.");
    return;
  }
  if (tab) tab.location.replace(url);
  else window.open(url, "_blank", "noopener,noreferrer"); // fallback
}

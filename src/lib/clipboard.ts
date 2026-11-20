/** Copy text and wipe it from the clipboard after `clearAfterSec` (if still ours). */
export async function copyWithAutoClear(text: string, clearAfterSec = 0): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return false;
  }
  if (clearAfterSec > 0) {
    window.setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === text) await navigator.clipboard.writeText('');
      } catch {
        // Reading needs permission on some browsers — clear anyway only if
        // the page still has focus (we most likely put it there).
        if (document.hasFocus()) {
          try {
            await navigator.clipboard.writeText('');
          } catch {
            // ignore
          }
        }
      }
    }, clearAfterSec * 1000);
  }
  return true;
}

export function navigate(hash: string): void {
  if (location.hash === hash) {
    // force a re-render even if the hash is unchanged
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = hash;
  }
}

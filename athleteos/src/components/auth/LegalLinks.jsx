export default function LegalLinks() {
  return <nav aria-label="Confidentialité et conditions" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-4">
    <a href="/?legal=privacy" target="_blank" rel="noreferrer" className="underline py-3">Confidentialité</a>
    <a href="/?legal=terms" target="_blank" rel="noreferrer" className="underline py-3">Conditions d’utilisation</a>
    <a href="/?legal=legal" target="_blank" rel="noreferrer" className="underline py-3">Mentions légales</a>
  </nav>;
}

import { useState } from "react";
import { Modal, Button, personName } from "./ui";
import { errorMessage, type WorkspaceChanges, type WorkspaceSnapshot } from "../backend/contracts";
import { readLocalImport } from "../backend/localImport";
import { useAsyncAction } from "../backend/useAsyncAction";

export default function LocalImport({ snapshot, onImport, onClose, notify }: {
  snapshot: WorkspaceSnapshot;
  onImport: (changes: WorkspaceChanges) => Promise<void>;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [preview] = useState(() => {
    try { return { data: readLocalImport(snapshot), error: "" }; }
    catch (cause) { return { data: null, error: errorMessage(cause) }; }
  });
  const action = useAsyncAction();
  const data = preview.data;
  const count = data ? data.members.length + data.services.length : 0;
  return <Modal title="Reprendre les données locales" description="Vérifiez les informations avant de les ajouter à l’espace partagé." onClose={() => { if (!action.pending) onClose(); }}>
    {data && <div className="form-fields">
      <p><strong>{data.members.length} membre(s)</strong> et <strong>{data.services.length} service(s)</strong> à ajouter.</p>
      <p>{data.matched} membre(s) déjà présent(s), reconnu(s) par leur adresse e-mail. {data.skipped} service(s) identique(s) ignoré(s).</p>
      {count > 0 && <details className="form-details"><summary>Voir les données à importer</summary>
        <ul className="import-preview">{data.members.map(e => <li key={e.id}>{personName(e)} · {e.email}</li>)}{data.services.map(s => <li key={s.id}>{s.date} · {s.startTime}–{s.endTime} · {personName([...data.members, ...snapshot.employees].find(e => e.id === s.employeeId)!)}</li>)}</ul>
      </details>}
      <p className="info-note">Les fiches partagées existantes restent intactes. Les nouvelles fiches ont le rôle Employé et leur accès devra être activé séparément. Aucun mot de passe n’est transféré. La copie locale reste disponible.</p>
      {!count && <p>Aucune nouvelle donnée à importer sur cet appareil.</p>}
    </div>}
    {(preview.error || action.error) && <p className="form-error" role="alert">{preview.error || action.error}</p>}
    <div className="dialog-footer">
      <Button disabled={action.pending} onClick={onClose}>Fermer</Button>
      <Button variant="primary" disabled={!count || action.pending} onClick={() => void action.run(async () => {
        await onImport(data!.changes);
        notify("Les données locales ont été ajoutées à l’espace partagé.");
        onClose();
      })}>{action.pending ? "Import en cours…" : "Importer ces données"}</Button>
    </div>
  </Modal>;
}

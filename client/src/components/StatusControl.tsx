import { useUpdateStatus } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { STATUS_LABEL } from '../lib/format';
import { STATUSES, type Task } from '../types';
import { useToast } from './Toasts';

/**
 * Inline status changer. Sends `expectedStatus` so two people moving the same
 * task at once can't silently overwrite each other (server answers 409).
 */
export function StatusControl({ task }: { task: Pick<Task, 'id' | 'status' | 'title'> }) {
  const mutation = useUpdateStatus();
  const toast = useToast();
  const pending = mutation.isPending ? mutation.variables?.status : undefined;
  const value = pending ?? task.status;

  return (
    <select
      className={`status-select status--${value}`}
      value={value}
      disabled={mutation.isPending}
      aria-label={`Status of task #${task.id}`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const status = e.target.value as Task['status'];
        mutation.mutate(
          { id: task.id, status, expectedStatus: task.status },
          {
            onSuccess: () => toast(`Task #${task.id} moved to ${STATUS_LABEL[status]}`, 'success'),
            onError: (err) => toast(errorMessage(err), 'error'),
          },
        );
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

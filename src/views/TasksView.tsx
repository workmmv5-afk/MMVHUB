import React, { useMemo, useState } from 'react';
import { tx } from '../lib/i18n';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  FolderInput,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_TASK_LIST_ID, useVault } from '../context/VaultContext';
import type { RecurrenceCycle, TaskListRecord, TaskRecord } from '../types';
import {
  formatShortDate,
  formatTime12h,
  getOffsetDateISO,
  getTodayISO,
  parseNaturalTaskInput,
} from '../lib/format';

interface TasksViewProps {
  onNewTask: (listId?: string) => void;
  onEditTask: (task: TaskRecord) => void;
}

type TaskSortMode = 'order' | 'date' | 'starred' | 'title';
type DesktopLayout = 'list' | 'board' | 'matrix';

const STARRED_VIEW_ID = '__starred__';
const TODAY_VIEW_ID = '__today__';
const UPCOMING_VIEW_ID = '__upcoming__';
const UNSCHEDULED_VIEW_ID = '__unscheduled__';

interface InlineComposerProps {
  listId: string;
  defaultStarred?: boolean;
  compact?: boolean;
}

const InlineTaskComposer: React.FC<InlineComposerProps> = ({
  listId,
  defaultStarred = false,
  compact = false,
}) => {
  const { saveTask, taskLists } = useVault();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [repeat, setRepeat] = useState<RecurrenceCycle>('none');
  const [starred, setStarred] = useState(defaultStarred);
  const [submitting, setSubmitting] = useState(false);

  const isVirtualView =
    listId === STARRED_VIEW_ID ||
    listId === TODAY_VIEW_ID ||
    listId === UPCOMING_VIEW_ID ||
    listId === UNSCHEDULED_VIEW_ID;

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setDueDate('');
    setDueTime('');
    setRepeat('none');
    setStarred(defaultStarred);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const parsed = parseNaturalTaskInput(title, taskLists, getTodayISO());
      const resolvedDate =
        dueDate ||
        parsed.dueDate ||
        (listId === TODAY_VIEW_ID ? getTodayISO() : undefined);
      const resolvedTime = dueTime || parsed.dueTime;
      const resolvedListId = isVirtualView
        ? parsed.listId ?? DEFAULT_TASK_LIST_ID
        : listId;

      await saveTask({
        listId: resolvedListId,
        title: parsed.title,
        completed: false,
        starred: starred || listId === STARRED_VIEW_ID,
        priority: parsed.priority ?? 'medium',
        dueDate: resolvedDate,
        dueTime: resolvedDate && resolvedTime ? resolvedTime : undefined,
        repeat,
        area: parsed.area,
        notes: notes.trim() || undefined,
      });
      resetForm();
      setExpanded(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center gap-3 text-left text-sm font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition-colors ${
          compact ? 'px-4 py-3 min-h-[44px]' : 'px-5 py-3.5 min-h-[48px]'
        }`}
      >
        <Plus className="w-4 h-4 shrink-0" />
        <span>Add a task</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`border-b border-[#E1E3E1] dark:border-[#444746] bg-[#F8FAFD] dark:bg-[#282A2C]/50 space-y-3 ${
        compact ? 'p-3.5' : 'p-4 sm:px-5'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-2.5 w-5 h-5 rounded-full border-2 border-[#747775] dark:border-[#8E918F] shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
            maxLength={160}
            className="w-full bg-transparent text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3] placeholder:text-[#747775] focus:outline-none py-1"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Details"
            maxLength={400}
            className="w-full bg-transparent text-xs text-[#444746] dark:text-[#C4C7C5] placeholder:text-[#747775] focus:outline-none resize-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setStarred((s) => !s)}
          aria-label={starred ? 'Unstar' : 'Star'}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[#747775] hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
        >
          <Star
            className={`w-4 h-4 ${
              starred
                ? 'fill-[#0B57D0] text-[#0B57D0] dark:fill-[#A8C7FA] dark:text-[#A8C7FA]'
                : ''
            }`}
          />
        </button>
      </div>

      {/* Google Tasks quick date chips + time + repeat */}
      <div className="pl-7 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDueDate(getTodayISO())}
          className={`min-h-[30px] px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
            dueDate === getTodayISO()
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
              : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
          }`}
        >
          {tx('Today')}
        </button>
        <button
          type="button"
          onClick={() => setDueDate(getOffsetDateISO(1))}
          className={`min-h-[30px] px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
            dueDate === getOffsetDateISO(1)
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
              : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
          }`}
        >
          {tx('Tomorrow')}
        </button>
        <button
          type="button"
          onClick={() => setDueDate(getOffsetDateISO(7))}
          className={`min-h-[30px] px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
            dueDate === getOffsetDateISO(7)
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] border-transparent'
              : 'border-[#DADCE0] dark:border-[#444746] text-[#444746] dark:text-[#C4C7C5]'
          }`}
        >
          {tx('Next week')}
        </button>
        <input
          type="date"
          aria-label="Pick due date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="min-h-[30px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-2.5 text-[11px] text-[#1F1F1F] dark:text-[#E3E3E3]"
        />
        {dueDate && (
          <input
            type="time"
            aria-label="Pick due time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="min-h-[30px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-2.5 text-[11px] text-[#1F1F1F] dark:text-[#E3E3E3]"
          />
        )}
        <select
          aria-label="Repeat cadence"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RecurrenceCycle)}
          className="min-h-[30px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-2.5 text-[11px] text-[#1F1F1F] dark:text-[#E3E3E3]"
        >
          <option value="none">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="pl-7 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setExpanded(false);
          }}
          className="min-h-[36px] px-3.5 rounded-full text-xs font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
        >
          {tx('Cancel')}
        </button>
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="min-h-[36px] px-4 rounded-full hub-bg-accent text-xs font-medium disabled:opacity-40"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

interface TaskRowProps {
  task: TaskRecord;
  allLists: { id: string; name: string }[];
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  visibleOrderedIds: string[];
  showListName?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  onEditTask: (task: TaskRecord) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  allLists,
  canReorder,
  isFirst,
  isLast,
  visibleOrderedIds,
  showListName = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onEditTask,
}) => {
  const {
    toggleTaskCompleted,
    toggleTaskStarred,
    toggleTaskSubtask,
    addSubtaskToTask,
    deleteSubtaskFromTask,
    moveTaskToList,
    reorderTaskInList,
    deleteTask,
    tasks: allTasks,
  } = useVault();

  // Dependency: show what this task is waiting on (only while it's still open)
  const blocker = task.blockedBy
    ? allTasks.find((t) => t.id === task.blockedBy && !t.completed)
    : undefined;

  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const todayISO = getTodayISO();
  const isOverdue = !task.completed && task.dueDate && task.dueDate < todayISO;
  const currentListId = task.listId ?? DEFAULT_TASK_LIST_ID;
  const listName =
    allLists.find((l) => l.id === currentListId)?.name ?? 'My Tasks';

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    await addSubtaskToTask(task.id, subtaskText.trim());
    setSubtaskText('');
    setAddingSubtask(false);
  };

  return (
    <div className="group px-3.5 sm:px-4 py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]/60 transition-colors space-y-1.5">
      <div className="flex items-start gap-2">
        {selectionMode && !task.completed && onToggleSelect ? (
          <button
            type="button"
            onClick={() => onToggleSelect(task.id)}
            aria-label={isSelected ? `Deselect ${task.title}` : `Select ${task.title}`}
            className="min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center shrink-0"
          >
            <span
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-[#0B57D0] border-[#0B57D0] text-white dark:bg-[#A8C7FA] dark:border-[#A8C7FA] dark:text-[#062E6F]'
                  : 'border-[#747775] dark:border-[#8E918F]'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5" />}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void toggleTaskCompleted(task.id)}
            aria-label={
              task.completed
                ? `Mark ${task.title} incomplete`
                : `Complete ${task.title}`
            }
            className="min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center shrink-0"
          >
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.completed
                  ? 'bg-[#0B57D0] border-[#0B57D0] text-white dark:bg-[#A8C7FA] dark:border-[#A8C7FA] dark:text-[#062E6F]'
                  : 'border-[#747775] dark:border-[#8E918F] hover:border-[#0B57D0] dark:hover:border-[#A8C7FA]'
              }`}
            >
              {task.completed && <Check className="w-3.5 h-3.5" />}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            selectionMode && !task.completed && onToggleSelect
              ? onToggleSelect(task.id)
              : onEditTask(task)
          }
          className="min-w-0 flex-1 text-left py-1.5 space-y-1"
        >
          <p
            className={`text-sm font-medium leading-snug ${
              task.completed
                ? 'line-through text-[#747775]'
                : 'text-[#1F1F1F] dark:text-[#E3E3E3]'
            }`}
          >
            {task.title}
          </p>

          {blocker && !task.completed && (
            <p className="text-[11px] text-[#B06000] dark:text-[#FDD663] truncate">
              ⏳ Waiting on: {blocker.title}
            </p>
          )}

          {task.notes && !task.completed && (
            <p className="text-xs text-[#444746] dark:text-[#C4C7C5] line-clamp-2">
              {task.notes.replace(/[*`#>]|\[( |x|X)\]/g, '').trim()}
            </p>
          )}

          {(task.snoozeCount ?? 0) >= 3 && !task.completed && (
            <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
              Snoozed {task.snoozeCount}×
            </p>
          )}

          {(task.dueDate ||
            (task.repeat && task.repeat !== 'none') ||
            showListName ||
            task.priority === 'high' ||
            (task.estimateMinutes ?? 0) > 0 ||
            (task.focusedMinutes ?? 0) > 0) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#444746] dark:text-[#C4C7C5]">
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    isOverdue
                      ? 'text-[#B3261E] dark:text-[#F2B8B5] font-medium'
                      : 'text-[#0B57D0] dark:text-[#A8C7FA]'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>
                    {isOverdue ? 'Overdue · ' : ''}
                    {formatShortDate(task.dueDate)}
                    {task.dueTime ? ` · ${formatTime12h(task.dueTime)}` : ''}
                  </span>
                </span>
              )}
              {task.repeat && task.repeat !== 'none' && (
                <span className="inline-flex items-center gap-1 capitalize">
                  <Repeat className="w-3 h-3" />
                  <span>{task.repeat}</span>
                </span>
              )}
              {(task.estimateMinutes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>~{task.estimateMinutes}m</span>
                </span>
              )}
              {(task.focusedMinutes ?? 0) > 0 && (
                <span className="font-mono tabular-nums text-[#146C2E] dark:text-[#81C995]">
                  · {task.focusedMinutes}m focused
                </span>
              )}
              {showListName && <span>· {listName}</span>}
              {task.priority === 'high' && !task.completed && (
                <span className="text-[#B3261E] dark:text-[#F2B8B5] font-medium">
                  · High priority
                </span>
              )}
            </div>
          )}
        </button>

        {/* Actions */}
        <div className="relative flex items-center shrink-0">
          {!task.completed && (
            <button
              type="button"
              onClick={() => void toggleTaskStarred(task.id)}
              aria-label={task.starred ? 'Unstar task' : 'Star task'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[#747775] hover:bg-[#E1E7F0] dark:hover:bg-[#333537]"
            >
              <Star
                className={`w-4 h-4 ${
                  task.starred
                    ? 'fill-[#0B57D0] text-[#0B57D0] dark:fill-[#A8C7FA] dark:text-[#A8C7FA]'
                    : ''
                }`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`More actions for ${task.title}`}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[#747775] hover:bg-[#E1E7F0] dark:hover:bg-[#333537]"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onMouseLeave={() => setMenuOpen(false)}
              className="absolute right-0 top-10 z-30 w-52 rounded-2xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#282A2C] shadow-lg p-1.5 space-y-0.5 text-xs"
            >
              {!task.completed && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAddingSubtask(true);
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add a subtask</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEditTask(task);
                }}
                className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit details</span>
              </button>

              {canReorder && !task.completed && (
                <>
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => {
                      setMenuOpen(false);
                      void reorderTaskInList(
                        task.id,
                        'up',
                        visibleOrderedIds
                      );
                    }}
                    className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537] disabled:opacity-40"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Move up</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => {
                      setMenuOpen(false);
                      void reorderTaskInList(
                        task.id,
                        'down',
                        visibleOrderedIds
                      );
                    }}
                    className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537] disabled:opacity-40"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Move down</span>
                  </button>
                </>
              )}

              {allLists.length > 1 && (
                <div className="pt-1 mt-1 border-t border-[#E1E3E1] dark:border-[#444746]">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#747775]">
                    {tx('Move to list')}
                  </p>
                  {allLists
                    .filter((l) => l.id !== currentListId)
                    .map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void moveTaskToList(task.id, l.id);
                        }}
                        className="w-full min-h-[34px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span className="truncate">{l.name}</span>
                      </button>
                    ))}
                </div>
              )}

              <div className="pt-1 mt-1 border-t border-[#E1E3E1] dark:border-[#444746]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void deleteTask(task.id);
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 text-[#B3261E] dark:text-[#F2B8B5] hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Subtasks */}
      {task.subtasks && task.subtasks.length > 0 && !task.completed && (
        <div className="pl-10 space-y-1">
          {task.subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between gap-2 group/sub"
            >
              <button
                type="button"
                onClick={() => void toggleTaskSubtask(task.id, sub.id)}
                className="flex-1 text-left flex items-center gap-2.5 py-1 text-xs text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3]"
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    sub.done
                      ? 'bg-[#0B57D0] border-[#0B57D0] text-white dark:bg-[#A8C7FA] dark:border-[#A8C7FA] dark:text-[#062E6F]'
                      : 'border-[#747775] dark:border-[#8E918F]'
                  }`}
                >
                  {sub.done && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className={sub.done ? 'line-through opacity-60' : ''}>
                  {sub.text}
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete subtask"
                onClick={() => void deleteSubtaskFromTask(task.id, sub.id)}
                className="p-1.5 text-[#747775] hover:text-[#B3261E] opacity-60 group-hover/sub:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline Add Subtask Input */}
      {addingSubtask && !task.completed && (
        <form
          onSubmit={handleAddSubtask}
          className="pl-10 flex items-center gap-2 pt-1"
        >
          <input
            type="text"
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            placeholder="Subtask title..."
            autoFocus
            className="flex-1 min-h-[34px] rounded-full border border-[#DADCE0] dark:border-[#444746] bg-white dark:bg-[#1E1F20] px-3 text-xs text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none focus:border-[#0B57D0]"
          />
          <button
            type="submit"
            className="min-h-[34px] px-3 rounded-full hub-bg-accent text-xs font-medium"
          >
            {tx('Add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingSubtask(false);
              setSubtaskText('');
            }}
            className="min-h-[34px] px-2 text-xs text-[#747775]"
          >
            {tx('Cancel')}
          </button>
        </form>
      )}
    </div>
  );
};

interface TaskListCardProps {
  listId: string;
  title: string;
  isStarredView?: boolean;
  isVirtualView?: boolean;
  isCustomList?: boolean;
  tasks: TaskRecord[];
  allLists: { id: string; name: string }[];
  sortMode: TaskSortMode;
  compact?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
  onEditTask: (task: TaskRecord) => void;
  onRenameList?: (listId: string, currentName: string) => void;
  onDeleteList?: (listId: string) => void;
}

const TaskListCard: React.FC<TaskListCardProps> = ({
  listId,
  title,
  isStarredView = false,
  isVirtualView = false,
  isCustomList = false,
  tasks,
  allLists,
  sortMode,
  compact = false,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onEditTask,
  onRenameList,
  onDeleteList,
}) => {
  const { clearCompletedTasks } = useVault();
  const [completedOpen, setCompletedOpen] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState(false);

  const openTasks = useMemo(() => {
    const filtered = tasks.filter((t) => !t.completed);
    if (sortMode === 'date') {
      return [...filtered].sort((a, b) =>
        (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
      );
    }
    if (sortMode === 'starred') {
      return [...filtered].sort((a, b) => {
        if (Boolean(a.starred) !== Boolean(b.starred)) {
          return a.starred ? -1 : 1;
        }
        return (b.starredAt ?? 0) - (a.starredAt ?? 0);
      });
    }
    if (sortMode === 'title') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    return filtered;
  }, [tasks, sortMode]);

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [tasks]
  );

  const visibleOrderedIds = useMemo(
    () => openTasks.map((t) => t.id),
    [openTasks]
  );

  return (
    <section className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-visible flex flex-col">
      {/* List Card Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0F4F9] dark:border-[#282A2C] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isStarredView && (
            <Star className="w-4 h-4 text-[#0B57D0] dark:text-[#A8C7FA] fill-current shrink-0" />
          )}
          <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
            {title}
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#747775]">
            {openTasks.length}
          </span>
        </div>

        <div className="relative flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setListMenuOpen((o) => !o)}
            aria-label={`List options for ${title}`}
            className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-[#747775] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C]"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {listMenuOpen && (
            <div
              onMouseLeave={() => setListMenuOpen(false)}
              className="absolute right-0 top-10 z-30 w-52 rounded-2xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#282A2C] shadow-lg p-1.5 space-y-0.5 text-xs"
            >
              {isCustomList && onRenameList && (
                <button
                  type="button"
                  onClick={() => {
                    setListMenuOpen(false);
                    onRenameList(listId, title);
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 hover:bg-[#E9EEF6] dark:hover:bg-[#333537]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Rename list</span>
                </button>
              )}
              {completedTasks.length > 0 && !isStarredView && !isVirtualView && (
                <button
                  type="button"
                  onClick={() => {
                    setListMenuOpen(false);
                    void clearCompletedTasks(listId);
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 text-[#B3261E] dark:text-[#F2B8B5] hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete all completed</span>
                </button>
              )}
              {isCustomList && onDeleteList && (
                <button
                  type="button"
                  onClick={() => {
                    setListMenuOpen(false);
                    onDeleteList(listId);
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl text-left flex items-center gap-2 text-[#B3261E] dark:text-[#F2B8B5] hover:bg-[#FCE8E6] dark:hover:bg-[#601410]/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete list</span>
                </button>
              )}
              {!isCustomList && completedTasks.length === 0 && (
                <p className="px-3 py-2 text-[#747775]">
                  {tx('No list actions available')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline "+ Add a task" (exactly like Google Tasks) */}
      <InlineTaskComposer
        listId={listId}
        defaultStarred={isStarredView}
        compact={compact}
      />

      {/* Open Tasks */}
      {openTasks.length === 0 ? (
        <div className="py-10 px-6 text-center space-y-2 border-t border-[#F0F4F9] dark:border-[#282A2C]">
          <CheckCircle2 className="w-7 h-7 mx-auto text-[#0B57D0] dark:text-[#A8C7FA] opacity-70" />
          <p className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
            {isStarredView ? 'No starred tasks' : 'No tasks yet'}
          </p>
          <p className="text-xs text-[#444746] dark:text-[#C4C7C5]">
            {isStarredView
              ? 'Mark important tasks with a star to keep them front and center.'
              : 'Type naturally like "Pay rent tomorrow 9am !high" or add details.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C] border-t border-[#F0F4F9] dark:border-[#282A2C]">
          {openTasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              allLists={allLists}
              canReorder={sortMode === 'order' && !isStarredView && !isVirtualView}
              isFirst={idx === 0}
              isLast={idx === openTasks.length - 1}
              visibleOrderedIds={visibleOrderedIds}
              showListName={isStarredView || isVirtualView}
              selectionMode={selectionMode}
              isSelected={selectedIds?.has(task.id) ?? false}
              onToggleSelect={onToggleSelect}
              onEditTask={onEditTask}
            />
          ))}
        </div>
      )}

      {/* Collapsible Completed Section (Google Tasks style) */}
      {completedTasks.length > 0 && (
        <div className="border-t border-[#E1E3E1] dark:border-[#444746]">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCompletedOpen((o) => !o)}
              className="flex items-center gap-2 text-xs font-medium text-[#444746] dark:text-[#C4C7C5] min-h-[32px]"
            >
              {completedOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span>Completed ({completedTasks.length})</span>
            </button>
            {completedOpen && !isStarredView && (
              <button
                type="button"
                onClick={() => void clearCompletedTasks(listId)}
                className="text-xs font-medium text-[#B3261E] dark:text-[#F2B8B5] hover:underline"
              >
                {tx('Delete all')}
              </button>
            )}
          </div>
          {completedOpen && (
            <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C] border-t border-[#F0F4F9] dark:border-[#282A2C]">
              {completedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  allLists={allLists}
                  canReorder={false}
                  isFirst={false}
                  isLast={false}
                  visibleOrderedIds={[]}
                  showListName={isStarredView}
                  onEditTask={onEditTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export const TasksView: React.FC<TasksViewProps> = ({
  onNewTask,
  onEditTask,
}) => {
  const {
    tasks,
    taskLists,
    createTaskList,
    renameTaskList,
    deleteTaskList,
    batchUpdateTasks,
  } = useVault();

  const todayISO = getTodayISO();
  const next7EndISO = getOffsetDateISO(7, todayISO);

  const [selectedListId, setSelectedListId] =
    useState<string>(DEFAULT_TASK_LIST_ID);
  const [desktopLayout, setDesktopLayout] = useState<DesktopLayout>('list');
  const [sortMode, setSortMode] = useState<TaskSortMode>('order');
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Inline create/rename list controls
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renamingList, setRenamingList] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const allLists = useMemo(
    () => [
      { id: DEFAULT_TASK_LIST_ID, name: 'My Tasks' },
      ...taskLists.map((l: TaskListRecord) => ({ id: l.id, name: l.name })),
    ],
    [taskLists]
  );

  const filteredBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q) ||
        (t.area ?? '').toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const starredCount = useMemo(
    () => tasks.filter((t) => !t.completed && t.starred).length,
    [tasks]
  );

  const todayCount = useMemo(
    () =>
      tasks.filter(
        (t) => !t.completed && Boolean(t.dueDate) && t.dueDate! <= todayISO
      ).length,
    [tasks, todayISO]
  );

  const totalOpenCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatch = async (action: 'complete' | 'tomorrow' | 'delete') => {
    if (selectedIds.length === 0) return;
    await batchUpdateTasks(selectedIds, action);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const created = await createTaskList(newListName.trim());
    setNewListName('');
    setCreatingList(false);
    setSelectedListId(created.id);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingList || !renamingList.name.trim()) return;
    await renameTaskList(renamingList.id, renamingList.name.trim());
    setRenamingList(null);
  };

  const handleDeleteList = async (listId: string) => {
    await deleteTaskList(listId);
    if (selectedListId === listId) {
      setSelectedListId(DEFAULT_TASK_LIST_ID);
    }
  };

  const tasksForList = (listId: string) => {
    if (listId === STARRED_VIEW_ID) {
      return filteredBySearch.filter((t) => t.starred);
    }
    if (listId === TODAY_VIEW_ID) {
      return filteredBySearch.filter(
        (t) => Boolean(t.dueDate) && t.dueDate! <= todayISO
      );
    }
    if (listId === UPCOMING_VIEW_ID) {
      return filteredBySearch.filter(
        (t) =>
          Boolean(t.dueDate) &&
          t.dueDate! >= todayISO &&
          t.dueDate! <= next7EndISO
      );
    }
    if (listId === UNSCHEDULED_VIEW_ID) {
      return filteredBySearch.filter((t) => !t.dueDate);
    }
    return filteredBySearch.filter(
      (t) => (t.listId ?? DEFAULT_TASK_LIST_ID) === listId
    );
  };

  // 2x2 Eisenhower Matrix Quadrants over open filtered tasks
  const eisenhowerQuadrants = useMemo(() => {
    const open = filteredBySearch.filter((t) => !t.completed);
    const soonCutoff = getOffsetDateISO(2, todayISO);
    const isUrgent = (t: TaskRecord) =>
      Boolean(t.dueDate && t.dueDate <= soonCutoff);
    const isHigh = (t: TaskRecord) => t.priority === 'high' || Boolean(t.starred);

    return [
      {
        id: 'q1',
        title: 'Do First · Urgent & High',
        subtitle: 'High priority / starred due within 48h',
        items: open.filter((t) => isHigh(t) && isUrgent(t)),
      },
      {
        id: 'q2',
        title: 'Schedule · Important',
        subtitle: 'High priority / starred for later',
        items: open.filter((t) => isHigh(t) && !isUrgent(t)),
      },
      {
        id: 'q3',
        title: 'Focus · Due Soon',
        subtitle: 'Medium or low priority due within 48h',
        items: open.filter((t) => !isHigh(t) && isUrgent(t)),
      },
      {
        id: 'q4',
        title: 'Backlog · Unscheduled & Later',
        subtitle: 'Low urgency open items',
        items: open.filter((t) => !isHigh(t) && !isUrgent(t)),
      },
    ];
  }, [filteredBySearch, todayISO]);

  const activeListObj = allLists.find((l) => l.id === selectedListId);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const activeVirtualTitle =
    selectedListId === STARRED_VIEW_ID
      ? 'Starred tasks'
      : selectedListId === TODAY_VIEW_ID
        ? 'Today & Overdue'
        : selectedListId === UPCOMING_VIEW_ID
          ? 'Next 7 days'
          : selectedListId === UNSCHEDULED_VIEW_ID
            ? 'Unscheduled'
            : activeListObj?.name ?? 'My Tasks';

  const isVirtualSelected =
    selectedListId === STARRED_VIEW_ID ||
    selectedListId === TODAY_VIEW_ID ||
    selectedListId === UPCOMING_VIEW_ID ||
    selectedListId === UNSCHEDULED_VIEW_ID;

  return (
    <div className="space-y-4">
      {/* Minimal Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
              {tx('Tasks')}
            </h1>
            <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6] tabular-nums whitespace-nowrap">
              {totalOpenCount} open · {starredCount} starred
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tablet/Laptop List vs Board vs Matrix Switcher */}
            <div className="hidden md:inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F1F3F4] dark:bg-[#282A2C]">
              <button
                type="button"
                onClick={() => setDesktopLayout('list')}
                className={`min-h-[30px] px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  desktopLayout === 'list'
                    ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                    : 'text-[#5F6368] dark:text-[#9AA0A6]'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setDesktopLayout('board')}
                className={`min-h-[30px] px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  desktopLayout === 'board'
                    ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                    : 'text-[#5F6368] dark:text-[#9AA0A6]'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => setDesktopLayout('matrix')}
                className={`min-h-[30px] px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  desktopLayout === 'matrix'
                    ? 'bg-white dark:bg-[#1E1F20] text-[#202124] dark:text-[#E8EAED] shadow-2xs'
                    : 'text-[#5F6368] dark:text-[#9AA0A6]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Matrix</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectionMode((s) => !s);
                setSelectedIds([]);
              }}
              className={`min-h-[34px] px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                selectionMode
                  ? 'hub-bg-soft border-transparent'
                  : 'border-[#DADCE0] dark:border-[#3C4043] text-[#444746] dark:text-[#C4C7C5] hover:bg-[#F1F3F4] dark:hover:bg-[#282A2C]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {selectionMode ? 'Done' : 'Select'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNewTask(
                  isVirtualSelected ? DEFAULT_TASK_LIST_ID : selectedListId
                )
              }
              className="min-h-[36px] px-3.5 rounded-full hub-bg-accent text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Underline List Tabs + Smart Filters + Compact Search/Sort */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-[#E8EAED] dark:border-[#3C4043]">
          <div className="flex items-center gap-5 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedListId(TODAY_VIEW_ID);
                setDesktopLayout('list');
              }}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                selectedListId === TODAY_VIEW_ID && desktopLayout === 'list'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <span>Today</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">
                {todayCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedListId(UPCOMING_VIEW_ID);
                setDesktopLayout('list');
              }}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                selectedListId === UPCOMING_VIEW_ID && desktopLayout === 'list'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <span>Next 7d</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedListId(UNSCHEDULED_VIEW_ID);
                setDesktopLayout('list');
              }}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                selectedListId === UNSCHEDULED_VIEW_ID &&
                desktopLayout === 'list'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <span>Unscheduled</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedListId(STARRED_VIEW_ID);
                setDesktopLayout('list');
              }}
              className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                selectedListId === STARRED_VIEW_ID && desktopLayout === 'list'
                  ? 'hub-border-accent hub-text-accent'
                  : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Starred</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">
                {starredCount}
              </span>
            </button>

            {allLists.map((list) => {
              const openCnt = tasks.filter(
                (t) =>
                  !t.completed &&
                  (t.listId ?? DEFAULT_TASK_LIST_ID) === list.id
              ).length;
              const isActive =
                selectedListId === list.id && desktopLayout === 'list';
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setSelectedListId(list.id);
                    setDesktopLayout('list');
                  }}
                  className={`pb-2.5 text-xs sm:text-sm font-medium border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'hub-border-accent hub-text-accent'
                      : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#E8EAED]'
                  }`}
                >
                  <span>{list.name}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-75">
                    {openCnt}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCreatingList(true)}
              className="pb-2.5 text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 hub-text-accent hover:opacity-80"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New list</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2 lg:pb-1.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="w-3.5 h-3.5 text-[#5F6368] dark:text-[#9AA0A6] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tasks..."
                className="w-full min-h-[32px] rounded-lg bg-[#F1F3F4] dark:bg-[#282A2C] pl-8 pr-2.5 text-xs text-[#202124] dark:text-[#E8EAED] placeholder:text-[#5F6368] dark:placeholder:text-[#9AA0A6] focus:outline-none"
              />
            </div>

            <select
              aria-label="Sort tasks"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as TaskSortMode)}
              className="min-h-[32px] rounded-lg bg-[#F1F3F4] dark:bg-[#282A2C] px-2.5 text-xs font-medium text-[#202124] dark:text-[#E8EAED] focus:outline-none"
            >
              <option value="order">My Order</option>
              <option value="date">Due Date</option>
              <option value="starred">Starred</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Multi-Select Action Bar */}
      {selectionMode && (
        <div className="rounded-2xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#1E1F20] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
            {selectedIds.length === 0
              ? 'Tap tasks below to select'
              : `${selectedIds.length} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => void handleBatch('complete')}
              className="min-h-[34px] px-3 rounded-full hub-bg-soft text-xs font-medium disabled:opacity-40"
            >
              {tx('Complete')}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => void handleBatch('tomorrow')}
              className="min-h-[34px] px-3 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium disabled:opacity-40"
            >
              {tx('Tomorrow')}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => void handleBatch('delete')}
              className="min-h-[34px] px-3 rounded-full border border-[#DADCE0] dark:border-[#444746] text-xs font-medium text-[#B3261E] dark:text-[#F2B8B5] disabled:opacity-40"
            >
              {tx('Delete')}
            </button>
          </div>
        </div>
      )}

      {/* Create New List Inline Bar */}
      {creatingList && (
        <form
          onSubmit={handleCreateList}
          className="rounded-2xl border border-[#0B57D0] dark:border-[#A8C7FA] bg-white dark:bg-[#1E1F20] p-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Enter new list name (e.g., Groceries, Work, Travel)"
            autoFocus
            maxLength={60}
            className="flex-1 min-w-[200px] min-h-[40px] rounded-xl bg-[#F0F4F9] dark:bg-[#282A2C] px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 rounded-full hub-bg-accent text-xs font-medium"
          >
            {tx('Create List')}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingList(false);
              setNewListName('');
            }}
            className="min-h-[40px] px-3 rounded-full text-xs text-[#444746] dark:text-[#C4C7C5]"
          >
            {tx('Cancel')}
          </button>
        </form>
      )}

      {/* Rename List Inline Bar */}
      {renamingList && (
        <form
          onSubmit={handleRenameSubmit}
          className="rounded-2xl border border-[#0B57D0] dark:border-[#A8C7FA] bg-white dark:bg-[#1E1F20] p-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={renamingList.name}
            onChange={(e) =>
              setRenamingList({ ...renamingList, name: e.target.value })
            }
            autoFocus
            maxLength={60}
            className="flex-1 min-w-[200px] min-h-[40px] rounded-xl bg-[#F0F4F9] dark:bg-[#282A2C] px-3.5 text-sm text-[#1F1F1F] dark:text-[#E3E3E3] focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 rounded-full hub-bg-accent text-xs font-medium"
          >
            {tx('Save Name')}
          </button>
          <button
            type="button"
            onClick={() => setRenamingList(null)}
            className="min-h-[40px] px-3 rounded-full text-xs text-[#444746] dark:text-[#C4C7C5]"
          >
            {tx('Cancel')}
          </button>
        </form>
      )}

      {/* Workspace Body: Single List, Multi-List Google Tasks Board, or 2x2 Eisenhower Matrix */}
      {desktopLayout === 'board' ? (
        <div className="hidden md:grid grid-flow-col auto-cols-[minmax(300px,350px)] gap-4 overflow-x-auto pb-4 items-start">
          {allLists.map((list) => (
            <TaskListCard
              key={list.id}
              listId={list.id}
              title={list.name}
              isCustomList={list.id !== DEFAULT_TASK_LIST_ID}
              tasks={tasksForList(list.id)}
              allLists={allLists}
              sortMode={sortMode}
              compact
              selectionMode={selectionMode}
              selectedIds={selectedIdSet}
              onToggleSelect={handleToggleSelect}
              onEditTask={onEditTask}
              onRenameList={(id, name) => setRenamingList({ id, name })}
              onDeleteList={handleDeleteList}
            />
          ))}
        </div>
      ) : desktopLayout === 'matrix' ? (
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-4">
          {eisenhowerQuadrants.map((quad) => (
            <section
              key={quad.id}
              className="rounded-3xl border border-[#E1E3E1] dark:border-[#444746] bg-white dark:bg-[#1E1F20] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#F0F4F9] dark:border-[#282A2C] flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                    {quad.title}
                  </h2>
                  <p className="text-[11px] text-[#747775]">{quad.subtitle}</p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#747775]">
                  {quad.items.length}
                </span>
              </div>
              {quad.items.length === 0 ? (
                <p className="py-8 px-4 text-center text-xs text-[#747775]">
                  {tx('Clear')}
                </p>
              ) : (
                <div className="divide-y divide-[#F0F4F9] dark:divide-[#282A2C]">
                  {quad.items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      allLists={allLists}
                      canReorder={false}
                      isFirst={false}
                      isLast={false}
                      visibleOrderedIds={[]}
                      showListName
                      selectionMode={selectionMode}
                      isSelected={selectedIdSet.has(task.id)}
                      onToggleSelect={handleToggleSelect}
                      onEditTask={onEditTask}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : null}

      <div className={desktopLayout !== 'list' ? 'md:hidden' : ''}>
        <TaskListCard
          listId={selectedListId}
          title={activeVirtualTitle}
          isStarredView={selectedListId === STARRED_VIEW_ID}
          isVirtualView={isVirtualSelected}
          isCustomList={
            !isVirtualSelected && selectedListId !== DEFAULT_TASK_LIST_ID
          }
          tasks={tasksForList(selectedListId)}
          allLists={allLists}
          sortMode={sortMode}
          selectionMode={selectionMode}
          selectedIds={selectedIdSet}
          onToggleSelect={handleToggleSelect}
          onEditTask={onEditTask}
          onRenameList={(id, name) => setRenamingList({ id, name })}
          onDeleteList={handleDeleteList}
        />
      </div>
    </div>
  );
};

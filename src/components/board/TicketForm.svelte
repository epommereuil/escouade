<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { clipboardImage, copyToDisk, planByPath } from '../../lib/attachments';
  import { cycleRefusal, ticketBranch } from '../../lib/board';
  import { t } from '../../lib/i18n';
  import { api } from '../../lib/ipc';
  import { MAX_FILES, draftFiles, filesChanged, keptFile, ticketPlace, type FormFile } from '../../lib/ticket-files';
  import { NotImageError, draftImages, imagesChanged, readTicketImage, shownImage, type FormImage } from '../../lib/ticket-images';
  import { menu } from '../../lib/menu.svelte';
  import { keyLabel, primaryKey } from '../../lib/platform';
  import { ariaEnter } from '../../lib/shortcuts';
  import { app, type TicketFormDraft } from '../../lib/state.svelte';
  import type { Ticket, TicketDraft } from '../../lib/types';
  import { insertAt } from '../../lib/dictation';
  import type { DictationTarget } from '../../lib/dictation.svelte';
  import AttachmentChip from '../AttachmentChip.svelte';
  import MicButton from '../MicButton.svelte';
  import BranchPicker from '../branches/BranchPicker.svelte';
  import Modal from '../modals/Modal.svelte';
  import { tip } from '../../lib/tip';
  import { DEFAULT_TICKET_PREFIX } from '../../lib/worktrees';

  // The form of a ticket, new or edited, in a large window to write long texts in. `onsubmit` saves the ticket and tells
  // whether it did: the window closes then, else it stays with what was typed. `resume`: what had been typed, back from a
  // dialog that took the window's place (the confirmation of its closing).
  let {
    ticket,
    projectId,
    onsubmit,
    resume,
  }: {
    ticket?: Ticket;
    projectId: string;
    onsubmit: (d: TicketDraft) => boolean | void | Promise<boolean | void>;
    resume?: TicketFormDraft;
  } = $props();

  // What the form opened with, to tell whether leaving it loses anything.
  const start = untrack(() => ({
    title: ticket?.title ?? '',
    description: ticket?.description ?? '',
    criteria: ticket?.criteria.map((c) => c.text).join('\n') ?? '',
    maxLoops: ticket?.maxLoops ?? 5,
    after: ticket?.after ?? [],
    branch: ticket?.branch ?? '',
    images: ticket?.images.map((i) => i.file) ?? [],
    files: ticket?.files.map((f) => f.file) ?? [],
  }));
  const uid = $props.id();

  let title = $state(untrack(() => resume?.title ?? start.title));
  let description = $state(untrack(() => resume?.description ?? start.description));
  let criteria = $state(untrack(() => resume?.criteria ?? start.criteria));
  let maxLoops = $state(untrack(() => resume?.maxLoops ?? start.maxLoops));
  /** The tickets it comes after, in the order they were checked; those done since stay, unlisted (they hold nothing back). */
  let after = $state(untrack(() => [...(resume?.after ?? start.after)]));
  /** The existing branch its agent takes up; empty: the ticket's own, made when it starts. */
  let branch = $state(untrack(() => resume?.branch ?? start.branch));
  let branchButton = $state<HTMLButtonElement>();
  let choosing = $state(false);
  let query = $state('');
  /** Why the last ticket checked was refused (it waits for this one already). */
  let refusal = $state<string | null>(null);
  /**
   * Its images, pasted or dropped in the window, or picked: under the description. Those the ticket has show once read
   * (`onMount`), their place meanwhile.
   */
  let images = $state<FormImage[]>(
    untrack(
      () =>
        resume?.images?.map((i) => ({ ...i })) ??
        (ticket?.images ?? []).map((i) => ({ name: i.name, mediaType: i.mediaType, file: i.file, data: '', url: '', size: 0 })),
    ),
  );
  /**
   * The files of the ticket's images as the window shows them, what leaving it compares `images` to: `start.images` less
   * those the backend could not read (their file is gone), which the window drops by itself. That is no change of the user's.
   */
  let held = $state(untrack(() => [...(resume?.held ?? start.images)]));
  /**
   * Its other files, as chips under the images: those the ticket has, and the copies this form made in the drafts (a chip is
   * there while its copy is written). Never a file where it lies: the agent reads a ticket's files later, when it may be gone.
   */
  let files = $state<FormFile[]>(untrack(() => resume?.files ?? ticket?.files.map(keptFile) ?? []));
  /** Files being read: the ticket waits for them before it is added or saved. */
  let reading = $state(0);
  /** A copy is being written: its chip has no path yet, the ticket waits for it as well. */
  const copying = $derived(files.some((f) => f.copying));
  let dragOver = $state(false);
  let fileInput = $state<HTMLInputElement>();
  let form = $state<HTMLDivElement>();
  let imageList = $state<HTMLUListElement>();
  let fileList = $state<HTMLUListElement>();
  let descriptionField = $state<HTMLTextAreaElement>();

  // Dictated into the description, at its cursor: the shortcut too, while the focus is in the form.
  const dictated: DictationTarget = {
    kind: 'ticket',
    id: `ticket-${Math.random().toString(36).slice(2)}`,
    el: () => form,
    insert: (said) => {
      const f = descriptionField;
      const at = f && document.activeElement === f ? [f.selectionStart, f.selectionEnd] : [description.length, description.length];
      const r = insertAt(description, at[0], at[1], said);
      description = r.text;
      void tick().then(() => {
        descriptionField?.focus();
        descriptionField?.setSelectionRange(r.caret, r.caret);
      });
    },
  };
  let busy = $state(false);
  const ready = $derived(title.trim().length > 0 && !busy && !reading && !copying);
  const changed = $derived(
    title !== start.title ||
      description !== start.description ||
      criteria !== start.criteria ||
      maxLoops !== start.maxLoops ||
      branch !== start.branch ||
      after.length !== start.after.length ||
      after.some((id) => !start.after.includes(id)) ||
      imagesChanged(images, held) ||
      filesChanged(files, start.files),
  );
  /** What it may come after: the other tickets of the project not done yet, oldest first. */
  const candidates = $derived(
    Object.values(app.tickets)
      .filter((x) => x.projectId === projectId && x.column !== 'done' && x.id !== ticket?.id)
      .sort((a, b) => a.createdAt - b.createdAt),
  );
  /** Those whose key (or, imported, the key there) holds the search; those checked stay in sight. */
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const holds = (key: string | undefined) => !!key && key.toLowerCase().includes(q);
    return candidates.filter((x) => after.includes(x.id) || holds(x.key) || holds(x.external?.key));
  });

  /**
   * The dialog it is. Another one taking its place (the confirmation of its closing, « Quitter Escouade ? ») comes back to
   * it once cancelled: what was typed is kept in it.
   */
  const self = untrack(() => app.modal);
  onDestroy(() => {
    if (self?.kind === 'ticket')
      self.resume = {
        title,
        description,
        criteria,
        maxLoops,
        after: [...after],
        branch,
        images: images.map((i) => ({ ...i })),
        held: [...held],
        // Not a copy: the one of a file being written is still this list's, which it takes the chip out of if it fails.
        files,
      };
  });

  /** The ticket's images not read yet. Those whose file is gone are not the ticket's any more: they go from the list. */
  onMount(() => {
    if (!ticket || !images.some((i) => i.file && !i.url)) return;
    api
      .ticketImages(ticket.id)
      .then((read) => {
        for (const r of read) {
          const i = images.find((x) => x.file === r.file);
          if (i) Object.assign(i, shownImage(r));
        }
        // Gone from its folder: the ticket lets go of it once saved, which the window says.
        const lost = images.filter((i) => i.file && !i.url);
        for (const i of lost) app.toast(t('board.form.images.missing', { name: i.name }), 'error');
        images = images.filter((i) => !i.file || i.url);
        // Not a change of the user's, but any save sends the images (`submit`, against `start.images`) to take it off the ticket.
        held = held.filter((file) => !lost.some((i) => i.file === file));
      })
      .catch(failed);
  });

  /**
   * The whole window of the ticket takes them: its fields, its head and foot, and the window itself, which has the focus
   * once a thumbnail or the space between the fields is clicked.
   */
  onMount(() => {
    const dialog = form?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragOver = true;
    };
    const leave = () => (dragOver = false);
    dialog.addEventListener('paste', onPaste);
    dialog.addEventListener('dragover', over);
    dialog.addEventListener('dragleave', leave);
    dialog.addEventListener('drop', onDrop);
    return () => {
      dialog.removeEventListener('paste', onPaste);
      dialog.removeEventListener('dragover', over);
      dialog.removeEventListener('dragleave', leave);
      dialog.removeEventListener('drop', onDrop);
    };
  });

  // A file that cannot be added is named in a toast, never left out without a word.
  async function addFiles(source: Iterable<File> | Promise<File[]>) {
    reading++;
    try {
      for (const f of await source) {
        try {
          await addFile(f);
        } catch (e) {
          failed(e);
        }
      }
    } catch (e) {
      failed(e);
    } finally {
      reading--;
    }
  }

  /**
   * An image the chat reads becomes an image of the ticket, with its preview; any other file, or an image that is none or too
   * big, is copied to the drafts.
   */
  async function addFile(f: File) {
    if (ticketPlace(f) === 'image') {
      try {
        images.push(await readTicketImage(f, images));
        return;
      } catch (e) {
        // A « .png » that holds something else is a file like any other; any other refusal is the user's to read.
        if (!(e instanceof NotImageError)) throw e;
      }
    }
    attachFile(f);
  }

  /**
   * Its chip is there at once, while the file is copied. Not waited for: the next files of a drop do not wait for the copy of
   * a big one, and the ticket waits for the chip itself (`copying`).
   */
  function attachFile(f: File) {
    if (files.length >= MAX_FILES) throw new Error(t('board.form.files.tooMany', { name: f.name, max: MAX_FILES }));
    const plan = planByPath(f, app.settings);
    if ('refusal' in plan) throw new Error(plan.refusal);
    const abort = new AbortController();
    const chip = $state<FormFile>({
      kind: 'file',
      name: f.name,
      mediaType: '',
      data: '',
      size: f.size,
      kept: '',
      warn: plan.warn,
      copying: true,
      progress: 0,
      cancel: () => abort.abort(),
    });
    files.push(chip);
    void copyChip(f, chip, abort.signal);
  }

  /** The copy of a file that its chip stands for, until its path is known; a failed one takes its chip away. */
  async function copyChip(f: File, chip: FormFile, signal: AbortSignal) {
    try {
      chip.file = await copyToDisk(f, 'draft', { signal, onProgress: (done) => (chip.progress = done / f.size) });
      chip.copying = false;
      chip.cancel = undefined;
    } catch (e) {
      const i = files.indexOf(chip);
      if (i >= 0) files.splice(i, 1);
      // Taken away by the user: nothing to say.
      if (!signal.aborted) failed(e);
    }
  }

  /**
   * Its chip goes with it, as an image's thumbnail does (the focus moves on in the same way). A copy still being written stops;
   * one finished is erased. A file the ticket has is not: it goes from the ticket when the ticket is saved, not before.
   */
  async function removeFile(i: number) {
    erase(files.splice(i, 1)[0]);
    await tick();
    const crosses = fileList?.querySelectorAll<HTMLButtonElement>('.rm') ?? [];
    (crosses[Math.min(i, crosses.length - 1)] ?? descriptionField)?.focus();
  }

  /** A copy this form is writing stops, one it made is erased; a file the ticket has is not touched (it has no `file`). */
  function erase(f: FormFile) {
    if (f.copying) f.cancel?.();
    else if (f.file) api.attachDiscard('draft', f.file.path).catch(() => {});
  }

  /** Giving the ticket up erases the copies this form made, which no ticket will ever have; never the files the ticket had. */
  function discardCopies() {
    files.forEach(erase);
  }

  /**
   * Its cross goes with it: the focus moves to the cross of the next image, else of the one before, else to the description.
   * It stays in the form, where Ctrl+Enter adds the ticket.
   */
  async function removeImage(i: number) {
    images.splice(i, 1);
    await tick();
    const crosses = imageList?.querySelectorAll<HTMLButtonElement>('.rm') ?? [];
    (crosses[Math.min(i, crosses.length - 1)] ?? descriptionField)?.focus();
  }

  function failed(e: unknown) {
    app.toast(e instanceof Error ? e.message : String(e), 'error');
  }

  /**
   * The files pasted are attached to the ticket. Text stays text, even with an image beside it: the cells of a spreadsheet
   * come with an image of themselves.
   */
  function onPaste(e: ClipboardEvent) {
    if (e.clipboardData?.types.includes('text/plain')) return;
    const list = [...(e.clipboardData?.files ?? [])];
    if (list.length) {
      e.preventDefault();
      addFiles(list);
    } else {
      addFiles(clipboardImage().then((f) => (f ? [f] : [])));
    }
  }

  function onDrop(e: DragEvent) {
    dragOver = false;
    const list = [...(e.dataTransfer?.files ?? [])];
    if (list.length) {
      // Left to the WebView, a dropped file would replace the app.
      e.preventDefault();
      addFiles(list);
    }
  }

  /** What the ticket does when there is no branch to take up: its own, named after its key once it has one. */
  const prefix = $derived(app.projects.find((p) => p.id === projectId)?.ticketBranchPrefix ?? DEFAULT_TICKET_PREFIX);
  const own = $derived(
    ticket ? t('branches.ticket.own', { branch: ticketBranch(ticket.key, prefix) }) : t('branches.ticket.ownNew', { prefix }),
  );

  function branchMenu() {
    if (!branchButton) return;
    menu.showAt(branchButton, [
      { label: own, onClick: () => (branch = '') },
      {
        label: t('branches.ticket.existing'),
        // The branch is the user's: validating the ticket never deletes it.
        title: t('branches.ticket.existingKept'),
        // Once the menu has given the focus back to its button: the picker gives it back there in turn.
        onClick: async () => {
          await tick();
          choosing = true;
        },
      },
    ]);
  }

  /** A ticket checked that already waits for this one is refused: neither would ever start. */
  function toggle(x: Ticket, box: HTMLInputElement) {
    refusal = null;
    if (!box.checked) {
      after = after.filter((id) => id !== x.id);
      return;
    }
    const refused = ticket ? cycleRefusal(ticket, x, app.tickets) : null;
    if (refused) {
      refusal = refused;
      box.checked = false;
      return;
    }
    after = [...after, x.id];
  }

  /**
   * Leaves the window (Escape, its cross, a click outside, « Annuler »); what was typed is only given up once the user
   * agrees, « Annuler » there coming back to the form. Not while the ticket is saved: a refusal would have nowhere to show.
   */
  function leave() {
    if (busy) return;
    if (!changed) {
      app.modal = null;
      return;
    }
    app.modal = {
      kind: 'confirm',
      title: t('board.form.discardTitle'),
      body: t('board.form.discardBody'),
      confirm: t('board.form.discard'),
      danger: true,
      // Given up for good: the copies this form made are of no use to anyone. Cancelled, the form comes back with them.
      onConfirm: discardCopies,
      onCancel: () => (app.modal = self),
    };
  }

  async function submit() {
    if (!ready) return;
    busy = true;
    // Replaced while it saves (« Quitter Escouade ? »), the window does not come back to save twice; refused, it does.
    app.markAnswered(self);
    let saved: boolean | void = false;
    try {
      saved = await onsubmit({
        title: title.trim(),
        description: description.trim(),
        criteria: criteria
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        maxLoops,
        after: [...after],
        // Said only when it matters: a branch taken up, or the one of an edited ticket given up (empty).
        ...(branch || start.branch ? { branch } : {}),
        // Only when they changed from what the ticket had (not `held`: one gone from its folder is taken off at any save);
        // those of an edited ticket may not be read yet.
        ...(imagesChanged(images, start.images) ? { images: draftImages(images) } : {}),
        // The same for the files: the whole list, those kept by their file and the copies by their path.
        ...(filesChanged(files, start.files) ? { files: draftFiles(files) } : {}),
      });
    } finally {
      busy = false;
    }
    if (!saved) app.markAnswered(self, false);
    // Not a dialog that took its place meanwhile.
    else if (app.modal === self) app.modal = null;
  }

  /**
   * Ctrl+Enter (Cmd+Enter on macOS) adds the ticket from any field; Enter alone only from the title, the textareas take it as
   * a new line. Not a key held down: its repeats would go on to the next window, or write lines.
   */
  function chord(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.isComposing || !primaryKey(e) || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!e.repeat) void submit();
  }

  /**
   * The height of the window of the app: a short one gets two rows less in each big field, for the rest of the form to show.
   * The images take three rows of the description (their height) for the same reason, the chips of the files two.
   */
  let viewHeight = $state(window.innerHeight);
  const short = $derived(viewHeight < 820);

  /** The textarea grows with what is typed in it (up to its `max-height`), and keeps a height the user dragged it to. */
  function grow(node: HTMLTextAreaElement, _text: string) {
    const fit = () => {
      if (node.scrollHeight > node.clientHeight) node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
    };
    fit();
    return { update: fit };
  }
</script>

<svelte:window bind:innerHeight={viewHeight} />

<Modal title={ticket ? t('board.form.editTitle', { key: ticket.key }) : t('board.form.newTitle')} width={760} tall onclose={leave}>
  <div class="form" class:short class:drag={dragOver} role="presentation" bind:this={form} onkeydown={chord}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="title"
      placeholder={t('board.form.title')}
      aria-label={t('board.form.title')}
      bind:value={title}
      autofocus
      onkeydown={(e) => e.key === 'Enter' && !e.isComposing && !e.repeat && !primaryKey(e) && submit()}
    />
    <div class="grp">
      <div class="lab-row">
        <label class="lab" for="{uid}-description">{t('board.form.description')}</label>
        <input
          bind:this={fileInput}
          type="file"
          multiple
          hidden
          aria-label={t('board.form.attach')}
          onchange={(e) => {
            // Copied first: the list is the input's own, emptied with its value below, before `addFiles` reads it.
            addFiles([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = '';
          }}
        />
        <div class="lab-tools">
          <MicButton target={dictated} below />
          <button class="attach" use:tip={t('board.form.attachTitle')} onclick={() => fileInput?.click()}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              ><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg
            >{t('board.form.attach')}
          </button>
        </div>
      </div>
      <textarea
        bind:this={descriptionField}
        id="{uid}-description"
        class="description"
        rows={(short ? 10 : 12) - (images.length ? 3 : 0) - (files.length ? 2 : 0)}
        placeholder={t('board.form.descriptionPlaceholder')}
        bind:value={description}
        use:grow={description}
      ></textarea>
      {#if images.length}
        <ul class="imgs" bind:this={imageList} aria-label={t('board.form.images.label')}>
          {#each images as img, i (i)}
            {@const label =
              images.length > 1 ? t('board.form.images.ranked', { name: img.name, n: i + 1, total: images.length }) : img.name}
            <!-- Screenshots are all named image.png: with several images, each has its rank in its label. -->
            <li class="img">
              {#if img.url}
                <img src={img.url} alt={label} use:tip={{ text: label, cut: true }} />
              {:else}
                <span class="wait" role="img" aria-label={t('board.form.images.loading', { name: label })}></span>
              {/if}
              <button class="rm" aria-label={t('board.form.images.remove', { name: label })} onclick={() => removeImage(i)}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if files.length}
        <ul class="files" bind:this={fileList} aria-label={t('board.form.files.label')}>
          {#each files as f, i (f)}
            <li><AttachmentChip attachment={f} onremove={() => removeFile(i)} /></li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="grp">
      <label class="lab" for="{uid}-criteria">{t('board.form.criteria')}</label>
      <textarea id="{uid}-criteria" rows={short ? 5 : 6} placeholder={t('board.form.criteriaPlaceholder')} bind:value={criteria}></textarea>
    </div>
    <div class="meta" class:single={!candidates.length}>
      <div class="side">
        <div class="loops" role="group" aria-label={t('board.form.maxLoops')}>
          <span class="k">{t('board.form.maxLoops')}</span>
          {#each [3, 5, 8] as n (n)}
            <button class:on={maxLoops === n} aria-pressed={maxLoops === n} onclick={() => (maxLoops = n)}>{n}</button>
          {/each}
        </div>
        <div class="branch" role="group" aria-label={t('branches.ticket.branch')}>
          <span class="k" id="{uid}-branch">{t('branches.ticket.branch')}</span>
          <button
            class="pick mono"
            bind:this={branchButton}
            aria-haspopup="menu"
            aria-labelledby="{uid}-branch {uid}-branch-value"
            use:tip={branch || own}
            onclick={branchMenu}
          >
            <span id="{uid}-branch-value">{branch || own}</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
      {#if candidates.length}
        <div class="after" role="group" aria-label={t('board.form.after')}>
          <div class="find">
            <span class="k">{t('board.form.after')}</span>
            <input
              class="search"
              role="searchbox"
              placeholder={t('board.form.searchKey')}
              aria-label={t('board.form.searchKey')}
              spellcheck="false"
              autocomplete="off"
              bind:value={query}
            />
          </div>
          {#if shown.length}
            <ul class="deps">
              {#each shown as x (x.id)}
                <li>
                  <label
                    ><input type="checkbox" checked={after.includes(x.id)} onchange={(e) => toggle(x, e.currentTarget)} /><span
                      class="key mono">{x.key}</span
                    > <span class="name" use:tip={{ text: x.title, cut: true }}>{x.title}</span></label
                  >
                </li>
              {/each}
            </ul>
          {:else}
            <span class="none">{t('board.form.noMatch')}</span>
          {/if}
          {#if refusal}<span class="refusal" role="alert">{refusal}</span>{/if}
        </div>
      {/if}
    </div>
  </div>
  {#snippet footer()}
    <span class="hint">{t(ticket ? 'board.form.saveHint' : 'board.form.addHint', { key: keyLabel('Ctrl+Enter') })}</span>
    <button class="btn ghost" onclick={leave}>{t('common.cancel')}</button>
    <button class="btn primary" disabled={!ready} aria-keyshortcuts={ariaEnter()} onclick={submit}
      >{ticket ? t('common.save') : t('common.add')}</button
    >
  {/snippet}
</Modal>

{#if choosing}
  <BranchPicker over {projectId} anchor={branchButton} mode="pick" onclose={() => (choosing = false)} onpick={(b) => (branch = b.name)} />
{/if}

<style>
  /* The whole body of the window: an image is dropped anywhere in it. */
  .form {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    border-radius: var(--r-sm);
  }
  .form.drag {
    outline: 1px dashed var(--accent);
    outline-offset: 8px;
  }
  .title,
  textarea {
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line2);
    background: var(--bg);
    color: var(--text);
    font: inherit;
    outline: none;
  }
  .title:focus,
  textarea:focus {
    border-color: var(--accent);
  }
  .title {
    height: 40px;
    font-size: 14.5px;
    font-weight: 600;
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lab {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .lab-tools {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lab-tools :global(.mic) {
    width: 24px;
    height: 22px;
  }
  /* The description's label, and on its right what attaches an image to the ticket. */
  .lab-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .attach {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 6px;
    border: none;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
  }
  .attach:hover {
    background: var(--elev2);
    color: var(--text);
  }
  /* The images under the description, as the chat shows its attachments. */
  .imgs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* The files that are no image, as the chat shows them: chips. */
  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .img {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--r-sm);
    overflow: hidden;
    border: 1px solid var(--line2);
  }
  .img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .img .wait {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--elev2);
  }
  .rm {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }
  textarea {
    resize: vertical;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.55;
  }
  /* A short window: tighter, for the loops, the branch and the dependencies to show without scrolling. */
  .form.short {
    gap: 12px;
  }
  .form.short .title {
    height: 36px;
  }
  .form.short .grp {
    gap: 4px;
  }
  .form.short textarea {
    padding-block: 8px;
  }
  .form.short .meta {
    padding-top: 10px;
  }
  .form.short .side {
    gap: 10px;
  }
  /* Grows with its text up to this, then scrolls in itself. */
  .description {
    max-height: 60vh;
  }
  /* Beside each other: the loops and the branch, the dependencies. */
  .meta {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 16px 24px;
    align-items: start;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .meta.single {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .loops {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .k {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    margin-right: 4px;
  }
  .loops button {
    height: 26px;
    min-width: 30px;
    padding: 0 8px;
    border: 1px solid var(--line2);
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .loops button.on {
    background: var(--elev2);
    color: var(--text);
  }
  .branch {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--line2);
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--muted);
    font-size: 11.5px;
    cursor: pointer;
  }
  .pick:hover {
    color: var(--text);
    border-color: var(--accent);
  }
  .pick span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .after {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  /* The label and the search on one line, as the loops and the branch have theirs: less height for the list under them. */
  .find {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .search {
    flex: 1;
    min-width: 0;
    height: 30px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line2);
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    outline: none;
  }
  .search:focus {
    border-color: var(--accent);
  }
  /* A long column of tickets scrolls rather than stretch the form. */
  .deps {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 136px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .deps label {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding: 3px 4px;
    border-radius: var(--r-sm);
    font-size: 12.5px;
    cursor: pointer;
  }
  .deps label:hover {
    background: var(--elev2);
  }
  .deps input {
    margin: 0;
    flex: none;
    accent-color: var(--accent);
  }
  .deps .key {
    flex: none;
    font-size: 11px;
    color: var(--muted);
  }
  /* A long title is cut, in full in its tooltip. */
  .deps .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .none {
    font-size: 11.5px;
    color: var(--dim);
  }
  .refusal {
    font-size: 11.5px;
    color: var(--del);
  }
  /* The key that adds the ticket, at the foot's left: the buttons stay on the right. */
  .hint {
    flex: 1;
    align-self: center;
    font-size: 11.5px;
    color: var(--dim);
  }
</style>

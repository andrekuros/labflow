"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/rbac";
import { getUserPreferences, saveUserPreferences } from "@/app/actions/preferences";
import {
  parseBoardViewState,
  slugifyBoardViewName,
  uniqueBoardViewSlug,
  type BoardViewState,
  type SavedBoardView,
} from "@/lib/board-view";

export async function listBoardViews(): Promise<SavedBoardView[]> {
  const prefs = await getUserPreferences();
  return prefs.boardViews ?? [];
}

export async function saveBoardView(input: {
  id?: string;
  name: string;
  state: BoardViewState;
}): Promise<{ error?: string; view?: SavedBoardView }> {
  await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "Nome obrigatorio" };
  if (name.length > 80) return { error: "Nome muito longo" };

  const prefs = await getUserPreferences();
  const views = [...(prefs.boardViews ?? [])];
  const state = parseBoardViewState(input.state);
  const baseSlug = slugifyBoardViewName(name);

  if (input.id) {
    const idx = views.findIndex((v) => v.id === input.id);
    if (idx < 0) return { error: "Modelo nao encontrado" };
    const slug = uniqueBoardViewSlug(baseSlug, views, input.id);
    const view: SavedBoardView = { ...state, id: input.id, name, slug };
    views[idx] = view;
    await saveUserPreferences({ ...prefs, boardViews: views });
    revalidatePath("/board");
    return { view };
  }

  const id = crypto.randomUUID();
  const slug = uniqueBoardViewSlug(baseSlug, views);
  const view: SavedBoardView = { ...state, id, name, slug };
  views.push(view);
  await saveUserPreferences({ ...prefs, boardViews: views });
  revalidatePath("/board");
  return { view };
}

export async function deleteBoardView(id: string): Promise<{ error?: string }> {
  await requireUser();
  const prefs = await getUserPreferences();
  const views = (prefs.boardViews ?? []).filter((v) => v.id !== id);
  if (views.length === (prefs.boardViews ?? []).length) return { error: "Modelo nao encontrado" };
  await saveUserPreferences({ ...prefs, boardViews: views });
  revalidatePath("/board");
  return {};
}

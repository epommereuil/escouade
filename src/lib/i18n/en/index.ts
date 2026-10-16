// The English catalog: each zone is checked against the French one where it is written (`defineZone`), and the
// whole of it here, so that a zone left out fails to compile too.
import { defineCatalog } from '../types';
import accounts from './accounts';
import bgtasks from './bgtasks';
import board from './board';
import boardSettings from './boardSettings';
import branches from './branches';
import common from './common';
import composer from './composer';
import conv from './conv';
import editor from './editor';
import errors from './errors';
import format from './format';
import git from './git';
import integrations from './integrations';
import mcp from './mcp';
import nav from './nav';
import plan from './plan';
import runs from './runs';
import settings from './settings';
import shell from './shell';
import stats from './stats';
import subagents from './subagents';
import voice from './voice';

export const en = defineCatalog({
  common,
  format,
  editor,
  settings,
  integrations,
  boardSettings,
  board,
  stats,
  nav,
  git,
  conv,
  composer,
  runs,
  shell,
  errors,
  accounts,
  mcp,
  branches,
  plan,
  subagents,
  bgtasks,
  voice,
});

import $ from 'jquery';
import { S } from './state';
import {
  algToId, bestTimeNumber, bestTimeString, averageOfFiveTimeNumber,
  averageTimeString, learnedStatus, learnedSVG,
  buildStickeringMaskString, getOrientationCompensation, applyMaskToPlayer,
  getFailedCount, getSuccessCount, getPracticeCount,
} from './functions';
import { timingPrefix } from './timer';

/** Renders the "last completed case" mini-tile below the practice area. */
export function renderLastCaseTile() {
  const container = $('#last-case-tile');
  if (!S.showLastCaseTileEnabled || !S.lastCompletedCase) {
    container.empty().addClass('hidden');
    return;
  }
  const alg = S.lastCompletedCase.algorithm;
  const name = S.lastCompletedCase.name;
  const algId = algToId(alg);
  const mainTile = $('#' + algId);
  const category = mainTile.data('category') || $('#category-select').val()?.toString() || '';
  const subset = mainTile.data('subset') || '';
  const ignore = mainTile.data('ignore') || '';
  const masking = mainTile.data('masking') || '';
  const algCompensation = getOrientationCompensation(alg);
  const tileAlg = algCompensation ? `${alg} ${algCompensation}` : alg;
  const stickering = buildStickeringMaskString(S.fullStickeringEnabled ? 'full' : (masking || category), ignore);
  let visualization = "3D";
  if (category.toLowerCase().includes("ll")) visualization = "experimental-2D-LL";

  const prefix = timingPrefix();
  const bestTime = bestTimeNumber(algId, prefix);
  const ao5 = averageOfFiveTimeNumber(algId, prefix);
  const isSelected = $(`#case-toggle-${algId}`).is(':checked');

  // Compute success/fail counts
  const failedCount = getFailedCount(algId);
  const successCount = getSuccessCount(algId);
  const practiceCount = getPracticeCount(algId);

  let successFailHtml = '';
  if (practiceCount > 0) {
    successFailHtml = `<div class="text-green-600 font-bold">✅: ${successCount}</div>`;
    if (failedCount > 0) successFailHtml += `<div class="text-red-600 font-bold">❌: ${failedCount}</div>`;
  }

  container.html(`
    <div class="case-wrapper rounded-lg shadow-md bg-gray-200 dark:bg-gray-800 relative p-4 flex flex-col" data-name="${name}" data-algorithm="${alg}" data-category="${category}" data-subset="${subset}"${ignore ? ` data-ignore="${ignore}"` : ''}>
      <div class="flex justify-between items-center">
        <div class="text-left text-sm w-full" title="${alg}">${name}</div>
        <div class="text-right ml-1"><button id="last-tile-bookmark-${algId}" data-algid="${algId}" title="Learning status" class="block last-tile-bookmark">${learnedSVG(learnedStatus(algId))}</button></div>
      </div>
      <label for="last-case-toggle-${algId}" class="cursor-pointer flex flex-col flex-grow justify-between">
        <div class="font-mono text-gray-900 dark:text-white text-xs">Best: ${bestTimeString(bestTime)}</div>
        <div class="font-mono text-gray-900 dark:text-white text-xs">Ao5: ${averageTimeString(ao5)}</div>
        <div class="flex items-center gap-2 text-xs mt-1">${successFailHtml}</div>
        <div class="flex items-center justify-center scale-50 -mx-20 -mt-10 -mb-10 pointer-events-none">
          <twisty-player puzzle="3x3x3" visualization="${visualization}" alg="${tileAlg}" experimental-setup-anchor="end" control-panel="none" hint-facelets="none" experimental-drag-input="none" background="none"></twisty-player>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-1 mb-2">${alg}</div>
        <div class="grid grid-cols-2 mt-0 relative z-10">
          <input type="checkbox" id="last-case-toggle-${algId}" class="sr-only last-case-toggle" data-algorithm="${alg}" data-name="${name}" data-best="${bestTime}" data-ignore="${ignore || ''}" data-algid="${algId}" ${isSelected ? 'checked' : ''} />
          <div class="w-11 h-6 bg-gray-400 rounded-full shadow-inner"></div>
          <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out"></div>
          <div class="flex items-center gap-2 justify-end">
            <button class="delete-case-btn text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" data-algorithm="${alg}" data-category="${category}" title="Delete case">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
            <button class="edit-case-btn text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" data-algorithm="${alg}" data-name="${name}" data-category="${category}" data-subset="${subset}" title="Edit algorithm">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button class="stats-case-btn text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" data-algorithm="${alg}" data-name="${name}" title="Show stats">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </button>
          </div>
        </div>
      </label>
    </div>
  `);
  // Apply per-facelet stickering mask via JS property (object API)
  const tilePlayer = container.find('twisty-player')[0];
  if (tilePlayer) applyMaskToPlayer(tilePlayer, stickering);
  container.removeClass('hidden');
}

/** Registers delegated click/change handlers for the last-case tile and practice-stats bookmark. */
export function initTileHandlers() {
  // Handle bookmark clicks on the last case tile
  $('#last-case-tile').on('click', '.last-tile-bookmark', function () {
    const algId = $(this).data('algid');
    let status = learnedStatus(algId);
    status = (status + 1) % 3;
    localStorage.setItem('Learned-' + algId, status.toString());
    $(this).html(learnedSVG(status));
    // Also update the main tile bookmark if visible
    $(`#bookmark-${algId}`).data('value', status).html(learnedSVG(status));
  });

  // Cycle learned status from the practice stats area bookmark
  $('#alg-stats').on('click', '#stats-bookmark-btn', function () {
    const algId = String($(this).attr('data-algid') || '');
    if (!algId) return;
    let status = learnedStatus(algId);
    status = (status + 1) % 3;
    localStorage.setItem('Learned-' + algId, status.toString());
    $(this).html(learnedSVG(status));
    $(`#bookmark-${algId}`).html(learnedSVG(status));
    $(`#last-tile-bookmark-${algId}`).html(learnedSVG(status));
    if ($('#stats-modal-bookmark').attr('data-algid') === algId) {
      $('#stats-modal-bookmark').html(learnedSVG(status));
    }
  });

  // Handle activate/deactivate toggle on the last case tile - sync with main tile
  $('#last-case-tile').on('change', '.last-case-toggle', function () {
    const algId = $(this).data('algid') as string;
    const isChecked = $(this).is(':checked');
    const mainToggle = $(`#case-toggle-${algId}`);
    mainToggle.prop('checked', isChecked).trigger('change');
  });

  // Delegate edit/stats/delete buttons on last case tile to the same handlers as #alg-cases
  $('#last-case-tile').on('click', '.edit-case-btn', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const algorithm = $(this).data('algorithm') as string;
    const algId = algToId(algorithm);
    $(`#${algId} .edit-case-btn`).trigger('click');
  });

  $('#last-case-tile').on('click', '.stats-case-btn', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const algorithm = $(this).data('algorithm') as string;
    const algId = algToId(algorithm);
    $(`#${algId} .stats-case-btn`).trigger('click');
  });

  $('#last-case-tile').on('click', '.delete-case-btn', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const algorithm = $(this).data('algorithm') as string;
    const algId = algToId(algorithm);
    $(`#${algId} .delete-case-btn`).trigger('click');
  });
}

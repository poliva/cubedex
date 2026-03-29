import $ from 'jquery';
import { S } from '../state';
import { algToId, expandNotation, getOrientationCompensation } from '../notationHelper';
import { deleteAlgorithm, exportAlgorithms, importAlgorithms as _importAlgorithms, initializeDefaultAlgorithms } from '../algorithmStorage';
import { learnedSVG, learnedStatus, bestTimeNumber, bestTimeString, averageOfFiveTimeNumber, averageTimeString, getFailedCount, getSuccessCount, getPracticeCount } from '../pageUtils';
import { buildStickeringMaskString } from '../faceMasking';
import { syncMirrorAlg, amimateCubeOrientation, resetmasterRepairFaceMap, setStickering, applyMaskToPlayer } from '../visualization';
import { rebuildCheckedAlgorithms } from '../trainer';
import { loadConfiguration } from './handlersOptions';

// ── Load / Display functions ───────────────────────────────────────────

/** Populates the #category-select dropdown from localStorage keys. */
export function loadCategories() {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const categorySelect = $('#category-select');
  categorySelect.empty();
  Object.keys(savedAlgorithms).forEach(category => {
    categorySelect.append(`<option value="${category}">${category}</option>`);
  });
  const selectedCategory = categorySelect.val() as string;
  loadSubsets(selectedCategory);
}

/** Loads and renders subset filter checkboxes for a category, then loads matching algorithms. */
export function loadSubsets(category: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const subsetCheckboxes = $('#subset-checkboxes-container');
  subsetCheckboxes.empty();
  if (savedAlgorithms[category]) {
    let isF2L = category === 'F2L';
    let currentSection = '';
    let isFirstSubset = true;
    savedAlgorithms[category].forEach((subset: { subset: string }) => {
      if (isF2L) {
        const sectionLabels: { [key: string]: string } = {
          '(S1)': 'Section 1 - Basic F2L',
          '(S2)': 'Section 2 - Advanced F2L, one piece in wrong Slot',
          '(S3)': 'Section 3 - Expert F2L, one pieces in wrong Slot, other flipped or in slot',
          '(S4)': 'Section 4 - Both Pieces Trapped in wrong Slot',
        };
        let sectionKey = '';
        for (const key of Object.keys(sectionLabels)) {
          if (subset.subset.includes(key)) {
            sectionKey = key;
            break;
          }
        }
        if (sectionKey && sectionKey !== currentSection) {
          currentSection = sectionKey;
          subsetCheckboxes.append(`
            <div class="col-span-full text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-400 dark:border-gray-500 pb-1 mt-4">${sectionLabels[sectionKey]}</div>
          `);
        }
      }
      const displayName = isF2L ? subset.subset.replace(/\s*\(S\d\)/, '') : subset.subset;
      const savedState = localStorage.getItem('SubsetChecked-' + category + '-' + subset.subset);
      const isChecked = savedState !== null ? savedState === '1' : isFirstSubset;
      isFirstSubset = false;
      subsetCheckboxes.append(`
        <label class="flex items-start col-span-1 cursor-pointer gap-2">
          <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 cursor-pointer flex-shrink-0 mt-0.5" name="${subset.subset}" value="${subset.subset}" ${isChecked ? 'checked' : ''}>
          <span>${displayName}</span>
        </label>
      `);
    });
  }
  loadAlgorithms(category);
}

/** Wrapper for importAlgorithms that injects loadCategories for UI refresh. */
export function importAlgorithms(file: File) {
  _importAlgorithms(file, loadCategories);
}

/** Renders algorithm case cards with cube preview, stats, and controls for a given category. */
export function loadAlgorithms(category: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const algCases = $('#alg-cases');
  algCases.empty();

  if (category && savedAlgorithms[category]) {
    setStickering(category);
    let visualization = "3D";
    if (category.toLowerCase().includes("ll")) visualization = "experimental-2D-LL";

    const checkedSubsets = $('#subset-checkboxes input:checked').map(function () {
      return $(this).val();
    }).get() as string[];

    checkedSubsets.forEach((subset) => {
      const subsetData = savedAlgorithms[category].find((s: { subset: string }) => s.subset === subset);
      if (subsetData) {
        const subsetMasking = subsetData.masking || '';
        let i = 0;
        subsetData.algorithms.forEach((alg: { name: string, algorithm: string, ignore?: string }) => {
          alg.algorithm = expandNotation(alg.algorithm);
          let algId = algToId(alg.algorithm);
          let gray = i % 2 == 0 ? "bg-gray-200" : "bg-gray-50";
          let grayDarkMode = i % 2 == 0 ? "bg-gray-800" : "bg-gray-700";
          const bestTime = bestTimeNumber(algId);
          const isSelected = localStorage.getItem(`Selected-${algId}`) === '1';
          const ignoreAttr = alg.ignore ? ` data-ignore="${alg.ignore}"` : '';
          const maskingAttr = subsetMasking ? ` data-masking="${subsetMasking}"` : '';
          const algCompensation = getOrientationCompensation(alg.algorithm);
          const tileAlg = algCompensation ? `${alg.algorithm} ${algCompensation}` : alg.algorithm;
          const tileMask = buildStickeringMaskString(subsetMasking || category, alg.ignore);

          algCases.append(`
            <div class="case-wrapper rounded-lg shadow-md ${gray} dark:${grayDarkMode} relative p-4 flex flex-col" id="${algId}" data-name="${alg.name}" data-algorithm="${alg.algorithm}" data-category="${category}" data-subset="${subset}"${ignoreAttr}${maskingAttr}>
              <div class="flex justify-between items-center">
                <div class="text-left text-sm w-full" title="${alg.algorithm}">${alg.name}</div>
                <div class="text-right ml-1"><button id="bookmark-${algId}" data-value="${learnedStatus(algId)}" title="Learning status" class="block">${learnedSVG(learnedStatus(algId))}</button></div>
              </div>
              <label for="case-toggle-${algId}" class="cursor-pointer flex flex-col flex-grow">
                <div id="best-time-${algId}" class="font-mono text-gray-900 dark:text-white text-xs">Best: ${bestTimeString(bestTime)}</div>
                <div id="ao5-time-${algId}" class="font-mono text-gray-900 dark:text-white text-xs">Ao5: ${averageTimeString(averageOfFiveTimeNumber(algId))}</div>
                <div class="flex items-center gap-2 text-xs mt-1">
                  <div id="${algId}-success" class="text-green-600 font-bold"></div>
                  <div id="${algId}-failed" class="text-red-600 font-bold"></div>
                </div>
                <div class="mt-auto">
                <div id="alg-case-${algId}" class="flex items-center justify-center scale-50 -mx-20 -mt-10 -mb-10 pointer-events-none">
                  <twisty-player puzzle="3x3x3" visualization="${visualization}" alg="${tileAlg}" experimental-setup-anchor="end" control-panel="none" hint-facelets="none" experimental-drag-input="none" background="none"></twisty-player>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 text-center font-mono break-all px-1 mb-2">${alg.algorithm}</div>
                </div>
                <div class="grid grid-cols-2 mt-0 relative z-10">
                  <input type="checkbox" id="case-toggle-${algId}" class="sr-only case-toggle" data-algorithm="${alg.algorithm}" data-name="${alg.name}" data-best="${bestTime}" data-ignore="${alg.ignore || ''}" data-masking="${subsetMasking}" ${isSelected ? 'checked' : ''} />
                  <div class="w-11 h-6 bg-gray-400 rounded-full shadow-inner"></div>
                  <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out"></div>
                  <div class="flex items-center gap-2 justify-end">
                    <button class="delete-case-btn text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" data-algorithm="${alg.algorithm}" data-category="${category}" title="Delete case">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    <button class="edit-case-btn text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" data-algorithm="${alg.algorithm}" data-name="${alg.name}" data-category="${category}" data-subset="${subset}" title="Edit algorithm">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button class="stats-case-btn text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" data-algorithm="${alg.algorithm}" data-name="${alg.name}" title="Show stats">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                    </button>
                  </div>
                </div>
              </label>
            </div>
          `);
          // Apply per-facelet stickering mask via JS property (object API)
          const tilePlayer = document.querySelector(`#alg-case-${algId} twisty-player`);
          if (tilePlayer) applyMaskToPlayer(tilePlayer, tileMask);
          const practiceCount = getPracticeCount(algId);
          const failedCount = getFailedCount(algId);
          const successCount = getSuccessCount(algId);
          if (practiceCount > 0) {
            $(`#${algId}-success`).html(`\u2705: ${successCount}`);
            if (failedCount > 0) $(`#${algId}-failed`).html(`\u274C: ${failedCount}`);
          }
          $(`#${algId}`).data('failed', failedCount);
          i++;
        });
      }
    });
  }
}

// Bookmark button event listener
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('button[id^="bookmark-"]')) {
    const button = target.closest('button') as HTMLButtonElement;
    const algId = button.id.replace('bookmark-', '');
    let currentStatus = learnedStatus(algId);
    currentStatus = (currentStatus + 1) % 3;
    localStorage.setItem('Learned-' + algId, currentStatus.toString());
    button.innerHTML = `${learnedSVG(currentStatus)}`;
  }
});

/** Shows or hides the selection controls bar depending on whether case tiles exist. */
export function updateSelectionControls() {
  const hasCases = $('#alg-cases').children().length > 0;
  if (hasCases) {
    $('#selection-controls').removeClass('hidden');
  } else {
    $('#selection-controls').addClass('hidden');
  }
  updateSelectedCasesCount();
}

/** Updates the "Selected cases: N" label and enables/disables the Start Practice button. */
export function updateSelectedCasesCount() {
  const practiceAll = ($('#select-all-toggle') as JQuery<HTMLInputElement>).prop('checked');
  let count = 0;
  if (practiceAll) {
    // When "Practice all" is on, count all case tiles
    count = $('#alg-cases').children('.case-wrapper').length;
  } else {
    // Count only case toggles that are checked
    count = $('#alg-cases input[type="checkbox"].case-toggle:checked').length;
  }
  const el = $('#selected-cases-count');
  el.text(`Selected cases: ${count}`);
  // Show "Selected cases" label whenever a category is selected
  const hasCategory = !!$('#category-select').val();
  if (hasCategory) {
    el.removeClass('hidden');
  } else {
    el.addClass('hidden');
  }
  // Gray out Start Practice when 0 cases selected
  const btn = $('#start-practice');
  if (count === 0) {
    btn.prop('disabled', true).addClass('cursor-not-allowed bg-gray-400 dark:bg-gray-500').removeClass('hover:bg-green-700 bg-green-600');
  } else {
    btn.prop('disabled', false).removeClass('cursor-not-allowed bg-gray-400 dark:bg-gray-500').addClass('hover:bg-green-700 bg-green-600');
  }
}

/** Filters case cards by name based on the search input. Shows/hides the clear button. */
export function applyCaseSearchFilter() {
  const term = (($('#case-search') as JQuery<HTMLInputElement>).val() || '').toLowerCase();
  if (term) {
    $('#case-search-clear').removeClass('hidden');
  } else {
    $('#case-search-clear').addClass('hidden');
  }
  $('#alg-cases .case-wrapper').each(function () {
    const name = ($(this).data('name') || '').toLowerCase();
    if (!term || name.includes(term)) {
      $(this).show();
    } else {
      $(this).hide();
    }
  });
  updateSelectedCasesCount();
}

/** Resets the current practice drill - hides timer, clears alg display, returns to input mode. */
export function resetDrill() {
  $('#timer-container').hide();
  $('#timer').text('');
  $('#times-display').html('');
  $('#alg-display-container').hide();
  $('#alg-display').html('');
  $('#alg-scramble').hide();
  $('#alg-help-info').hide();
  $('#alg-scramble').text('');
  $('#alg-override-container').hide();
  S.inputMode = true;
  $('#alg-input').val('');
  $('#alg-input').show();
  $('#alg-stats').hide();
  $('#left-side-inner').hide();
}

/** Debounces category/filter reload - shows spinner, then reloads algorithms after a short delay. */
function scheduleFilterReload() {
  const casesHeight = $('#alg-cases').outerHeight() || 0;
  $('#alg-cases').empty();
  $('#category-loading-spinner').css('min-height', casesHeight + 'px').removeClass('hidden');
  if (S.filterChangeTimeout) clearTimeout(S.filterChangeTimeout);
  S.filterChangeTimeout = setTimeout(() => {
    S.filterChangeTimeout = null;
    const selectedCategory = $('#category-select').val() as string;
    loadAlgorithms(selectedCategory);
    applyCaseSearchFilter();
    updateSelectionControls();
    rebuildCheckedAlgorithms();
    $('#category-loading-spinner').css('min-height', '').addClass('hidden');
  }, 50);
}

/** Registers event handlers for the load/category page, selection controls, and import/export. */
export function initLoadHandlers() {
  // .case-toggle checkboxes on #alg-cases tiles - persists selection state to localStorage
  $('#alg-cases').on('change', 'input[type="checkbox"].case-toggle', function () {
    const algorithm = $(this).data('algorithm');
    const algId = algToId(algorithm);
    localStorage.setItem(`Selected-${algId}`, (this as HTMLInputElement).checked ? '1' : '0');
    updateSelectedCasesCount();
  });

  // #delete-mode-toggle checkbox - enables or disables the bulk delete buttons
  $('#delete-mode-toggle').on('change', () => {
    const isDeleteModeOn = $('#delete-mode-toggle').is(':checked');
    $('#delete-alg').prop('disabled', !isDeleteModeOn);
    $('#delete-times').prop('disabled', !isDeleteModeOn);
  });

  // #delete-times button - removes all timing data for the currently selected algorithms
  $('#delete-times').on('click', () => {
    if (confirm('Are you sure you want to remove the times for the selected algorithms?')) {
      const category = $('#category-select').val()?.toString() || '';
      for (const algorithm of S.checkedAlgorithms) {
        if (algorithm) {
          const algId = algToId(algorithm.algorithm);
          localStorage.removeItem('Best-' + algId);
          localStorage.removeItem('LastTimes-' + algId);
          localStorage.removeItem('Best-CD-' + algId);
          localStorage.removeItem('LastTimes-CD-' + algId);
        }
      }
      loadAlgorithms(category);
      updateSelectionControls();
    }
  });

  // #delete-alg button - permanently deletes the selected algorithms from storage
  $('#delete-alg').on('click', () => {
    const category = $('#category-select').val()?.toString() || '';
    if (S.checkedAlgorithms.length > 0) {
      if (confirm('Are you sure you want to delete the selected algorithms?')) {
        for (const algorithm of S.checkedAlgorithms) {
          if (algorithm && category) {
            deleteAlgorithm(category, algorithm.algorithm);
          }
        }
        loadAlgorithms(category);
        updateSelectionControls();
        // make sure delete mode is off
        const deleteModeToggle = $('#delete-mode-toggle');
        deleteModeToggle.prop('checked', false);
        deleteModeToggle.toggle();
        $('#delete-alg').prop('disabled', true);
        $('#delete-times').prop('disabled', true);
        S.checkedAlgorithms = [];
        S.checkedAlgorithmsCopy = [];
        // only re-load subsets if there are no more alg-cases (subset has been deleted)
        if ($('#alg-cases').children().length === 0) {
          loadSubsets(category);
        }
        // only re-load categories if there are no more subsets (category has been deleted)
        if ($('#subset-checkboxes-container').children().length === 0) {
          $('#select-all-subsets-toggle').prop('checked', false);
          loadCategories();
        }
        $('#delete-success').text('Algorithms deleted successfully');
        $('#delete-success').show();
        setTimeout(() => {
          $('#delete-success').fadeOut();
        }, 3000);
      }
    }
  });

  // .delete-case-btn on #alg-cases tiles - deletes a single algorithm after confirmation
  $('#alg-cases').on('click', '.delete-case-btn', function (event) {
    event.preventDefault();
    event.stopPropagation();
    const algorithm = $(this).data('algorithm') as string;
    const category = $(this).data('category') as string;
    if (algorithm && category && confirm('Delete this algorithm?')) {
      deleteAlgorithm(category, algorithm);
      S.checkedAlgorithms = S.checkedAlgorithms.filter(alg => alg.algorithm !== algorithm);
      S.checkedAlgorithmsCopy = S.checkedAlgorithmsCopy.filter(alg => alg.algorithm !== algorithm);
      loadAlgorithms(category);
      if ($('#alg-cases').children().length === 0) {
        loadSubsets(category);
      }
      if ($('#subset-checkboxes-container').children().length === 0) {
        loadCategories();
      }
    }
  });

  // #load-alg nav button - shows the load/category page and triggers train-alg to present the current case
  $('#load-alg').on('click', () => {
    $('#app-top').show();
    const categorySelect = $('#category-select');
    if (categorySelect.val() === null || categorySelect.val() === '') {
      loadCategories();
    }
    $('#load-container').show();
    $('#save-container').hide();
    $('#options-container').hide();
    $('#help').hide();
    $('#info').hide();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    $('#train-alg').trigger('click');
  });

  // #activate-all-btn button - checks all VISIBLE case-toggle checkboxes and saves selection
  $('#activate-all-btn').on('click', () => {
    $('#alg-cases .case-wrapper:visible input[type="checkbox"].case-toggle').each(function () {
      const algId = algToId($(this).data('algorithm'));
      localStorage.setItem(`Selected-${algId}`, '1');
      $(this).prop('checked', true);
    });
    updateSelectedCasesCount();
  });

  // #deactivate-all-btn button - unchecks all VISIBLE case-toggle checkboxes and saves selection
  $('#deactivate-all-btn').on('click', () => {
    $('#alg-cases .case-wrapper:visible input[type="checkbox"].case-toggle').each(function () {
      const algId = algToId($(this).data('algorithm'));
      localStorage.setItem(`Selected-${algId}`, '0');
      $(this).prop('checked', false);
    });
    updateSelectedCasesCount();
  });

  // #case-search input - live filter cases by name (case-insensitive substring match)
  $('#case-search').on('input', function () {
    applyCaseSearchFilter();
  });

  // #case-search-clear button - clears the search and resets the filter
  $('#case-search-clear').on('click', () => {
    ($('#case-search') as JQuery<HTMLInputElement>).val('').trigger('input');
  });

  // #start-practice button - rebuilds the checked algorithms list and starts training
  $('#start-practice').on('click', () => {
    // Clear last case tile and last solve time so stale data from a previous session doesn't show
    S.lastCompletedCase = null;
    S.lastSolveTime = null;
    S.lastSolveSuccess = null;
    S.previousAlgId = '';
    S.previousAlgName = '';
    S.previousAlgMoves = '';
    S.forceFix = true;
    requestAnimationFrame(amimateCubeOrientation);
    rebuildCheckedAlgorithms();
    $('#load-alg').trigger('click');
  });

  // #category-select dropdown - loads subsets and algorithms for the chosen category
  let categoryChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  $('#category-select').on('change', () => {
    const category = $('#category-select').val()?.toString();
    if (category) localStorage.setItem('lastCategory', category);
    // Restore saved "All Subsets" state for this category (default: OFF)
    const savedAllSubsets = category ? localStorage.getItem('allSubsets-' + category) : null;
    $('#select-all-subsets-toggle').prop('checked', savedAllSubsets === '1');
    if (savedAllSubsets === '1') {
      $('#subset-checkboxes-container').addClass('hidden');
      $('#subset-filters-btn-container').addClass('hidden');
    } else {
      $('#subset-checkboxes-container').removeClass('hidden');
      $('#subset-filters-btn-container').removeClass('hidden');
    }
    S.checkedAlgorithms = [];
    S.checkedAlgorithmsCopy = [];
    // reset search filter and cube alg and drill immediately
    ($('#case-search') as JQuery<HTMLInputElement>).val('');
    $('#case-search-clear').addClass('hidden');
    S.twistyPlayer.alg = '';
    syncMirrorAlg('');
    resetDrill();
    if (category) {
      // Clear cases and show spinner; defer heavy loading so browser can repaint the spinner first
      const casesHeight = $('#alg-cases').outerHeight() || 0;
      $('#alg-cases').empty();
      $('#category-loading-spinner').css('min-height', casesHeight + 'px').removeClass('hidden');
      if (categoryChangeTimeout) clearTimeout(categoryChangeTimeout);
      categoryChangeTimeout = setTimeout(() => {
        loadSubsets(category);
        $('#category-loading-spinner').css('min-height', '').addClass('hidden');
        rebuildCheckedAlgorithms();
        updateSelectionControls();
        // If "Select All" or "Select Learning" is enabled, auto-select all subsets to start practice immediately
        const selectAllToggle = $('#select-all-toggle');
        const selectLearningToggle = $('#select-learning-toggle');
        if (selectAllToggle.is(':checked') || selectLearningToggle.is(':checked')) {
          $('#select-all-subsets-toggle').prop('checked', true).trigger('change');
        }
      }, 50);
    } else {
      updateSelectionControls();
    }
  });

  // #subset-checkboxes container - reloads algorithms when individual subset filters change
  $('#subset-checkboxes').on('change', 'input[type="checkbox"]', () => {
    if (S.batchingSubsetChanges) return;
    const selectedCategory = $('#category-select').val() as string;
    const allCheckboxes = $('#subset-checkboxes-container input[type="checkbox"]');
    allCheckboxes.each(function () {
      const subsetName = $(this).val() as string;
      localStorage.setItem('SubsetChecked-' + selectedCategory + '-' + subsetName, (this as HTMLInputElement).checked ? '1' : '0');
    });
    scheduleFilterReload();
  });

  // #activate-all-filters-btn button - checks all subset filter checkboxes at once
  $('#activate-all-filters-btn').on('click', () => {
    S.batchingSubsetChanges = true;
    const selectedCategory = $('#category-select').val() as string;
    $('#subset-checkboxes-container input[type="checkbox"]').each(function () {
      $(this).prop('checked', true);
      const subsetName = $(this).val() as string;
      localStorage.setItem('SubsetChecked-' + selectedCategory + '-' + subsetName, '1');
    });
    S.batchingSubsetChanges = false;
    scheduleFilterReload();
  });

  // #deactivate-all-filters-btn button - unchecks all subset filter checkboxes at once
  $('#deactivate-all-filters-btn').on('click', () => {
    S.batchingSubsetChanges = true;
    const selectedCategory = $('#category-select').val() as string;
    $('#subset-checkboxes-container input[type="checkbox"]').each(function () {
      $(this).prop('checked', false);
      const subsetName = $(this).val() as string;
      localStorage.setItem('SubsetChecked-' + selectedCategory + '-' + subsetName, '0');
    });
    S.batchingSubsetChanges = false;
    scheduleFilterReload();
  });

  // #export-algs button - downloads all algorithms as a JSON file
  $('#export-algs').on('click', () => {
    exportAlgorithms();
  });

  // #import-algs button - opens the hidden file picker to import algorithms from JSON
  $('#import-algs').on('click', () => {
    $('#import-file').trigger('click');
  });

  // #clear-local-storage button - wipes all localStorage data without interrupting BT connection
  $('#clear-local-storage').on('click', () => {
    if (confirm('This will delete ALL your progress, all settings, and ALL custom algs will be gone and replaced by default. Are you sure?')) {
      localStorage.clear();
      initializeDefaultAlgorithms();
      loadConfiguration();
      resetmasterRepairFaceMap();
      S.checkedAlgorithms = [];
      S.checkedAlgorithmsCopy = [];
      S.patternStates = [];
      S.algPatternStates = [];
      S.userAlg = [];
      S.displayAlg = [];
      S.originalUserAlg = [];
      S.inputMode = true;
      S.scrambleMode = false;
      S.twistyPlayer.alg = '';
      syncMirrorAlg('');
      resetDrill();
      loadCategories();
      updateSelectionControls();
      // Navigate to load page
      $('#options-container').hide();
      $('#load-container').show();
      $('#app-top').show();
    }
  });

  // #import-file hidden input - reads the selected JSON file and imports algorithms
  $('#import-file').on('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      importAlgorithms(file);
    }
  });

  // #select-all-subsets-toggle checkbox - toggles between showing all subsets or only checked ones
  $('#select-all-subsets-toggle').on('change', function () {
    S.checkedAlgorithms = [];
    S.checkedAlgorithmsCopy = [];
    const isChecked = $(this).is(':checked');
    const selectedCategory = $('#category-select').val() as string;
    if (selectedCategory) localStorage.setItem('allSubsets-' + selectedCategory, isChecked ? '1' : '0');
    if (isChecked) {
      // Show all: hide filter checkboxes, check all subsets
      $('#subset-checkboxes-container').addClass('hidden');
      $('#subset-filters-btn-container').addClass('hidden');
      $('#subset-checkboxes-container input[type="checkbox"]').prop('checked', true);
    } else {
      // Filter mode: show filter checkboxes, restore saved individual subset states
      $('#subset-checkboxes-container').removeClass('hidden');
      $('#subset-filters-btn-container').removeClass('hidden');
      $('#subset-checkboxes-container input[type="checkbox"]').each(function () {
        const subsetName = $(this).val() as string;
        const savedState = selectedCategory ? localStorage.getItem('SubsetChecked-' + selectedCategory + '-' + subsetName) : null;
        $(this).prop('checked', savedState === '1');
      });
    }
    scheduleFilterReload();
  });

  // #select-all-toggle checkbox - "Practice All" ignores individual case selection, includes every visible case
  const selectAllToggle = document.getElementById('select-all-toggle') as HTMLInputElement;
  selectAllToggle.addEventListener('change', () => {
    const ignoreSelection = selectAllToggle.checked;
    localStorage.setItem('ignoreSelection', ignoreSelection.toString());
    if (ignoreSelection) {
      $('#alg-cases .case-toggle').closest('label').find('.dot, .w-11').addClass('opacity-50');
    } else {
      $('#alg-cases .case-toggle').closest('label').find('.dot, .w-11').removeClass('opacity-50');
    }
    rebuildCheckedAlgorithms();
    updateSelectedCasesCount();
  });

  // #select-learning-toggle checkbox - filters practice to only "Learning" status cases
  $('#select-learning-toggle').on('change', function () {
    const isChecked = $(this).is(':checked');
    if (isChecked) {
      // Mutually exclusive with select-learned
      $('#select-learned-toggle').prop('checked', false);
    }
    rebuildCheckedAlgorithms();
  });

  // #select-learned-toggle checkbox - filters practice to only "Learned" status cases
  $('#select-learned-toggle').on('change', function () {
    const isChecked = $(this).is(':checked');
    if (isChecked) {
      // Mutually exclusive with select-learning
      $('#select-learning-toggle').prop('checked', false);
    }
    rebuildCheckedAlgorithms();
  });

  // Restore the last selected category or update selection controls for the default
  const categorySelect = $('#category-select');
  if (categorySelect.val() === null || categorySelect.val() === '') {
    loadCategories();
  }
  const lastCategory = localStorage.getItem('lastCategory');
  if (lastCategory && $('#category-select option[value="' + lastCategory + '"]').length > 0) {
    $('#category-select').val(lastCategory).trigger('change');
  } else {
    updateSelectionControls();
  }
}

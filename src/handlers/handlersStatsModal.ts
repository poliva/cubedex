import $ from 'jquery';
import { S } from '../state';
import {
  algToId, learnedStatus, learnedSVG, getLastTimes,
  bestTimeNumber, bestTimeString, averageTimeString,
  averageOf12TimeNumber, countMovesETM, createModalStatsGraph,
  loadAlgorithms,
  getFailedCount, getSuccessCount, getPracticeCount,
} from '../functions';
import { updateTimesDisplay } from '../statsPanel';

/** Registers event handlers for the statistics modal dialog. */
export function initStatsModalHandlers() {
  // .stats-case-btn on #alg-cases tiles - opens the per-case statistics modal with graphs, averages, and PBs
  $('#alg-cases').on('click', '.stats-case-btn', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const btn = $(this);
    const algorithm = btn.data('algorithm') as string;
    const name = btn.data('name') as string;
    const algId = algToId(algorithm);
    const moveCount = countMovesETM(algorithm);

    $('#stats-modal-title').text(name);
    $('#stats-modal-alg').text(algorithm);
    $('#stats-modal-bookmark').html(learnedSVG(learnedStatus(algId))).attr('data-algid', algId);
    $('#stats-modal-overlay').data('modalAlgId', algId);

    // Retrieve success/fail counts
    const practiceCount = getPracticeCount(algId);
    const failedCount = getFailedCount(algId);
    const successCount = getSuccessCount(algId);
    if (practiceCount > 0) {
      $(`#stats-modal-success`).html(`✅: ${successCount}`);
      if (failedCount > 0)
        $(`#stats-modal-failed`).html(`❌: ${failedCount}`);
      else
        $(`#stats-modal-failed`).html(``);
    }
    else {
      $(`#stats-modal-success`).html(``);
    }

    // Destroy previous chart instances
    if (S.modalExecChart) { S.modalExecChart.destroy(); S.modalExecChart = null; }
    if (S.modalRecexecChart) { S.modalRecexecChart.destroy(); S.modalRecexecChart = null; }

    // Build stats for a given prefix and populate the corresponding section
    function populateSection(prefix: string, graphId: string, avgId: string, tpsId: string, pbId: string, ao12Id: string, tpso12Id: string) {
      const lastTimes = getLastTimes(algId, prefix);
      const best = bestTimeNumber(algId, prefix);

      if (lastTimes.length === 0) {
        $(avgId).html('Average Time<br />-');
        $(tpsId).html('Average TPS<br />-');
        $(pbId).html('Single PB<br />-');
        $(ao12Id).html('Ao12<br />-');
        $(tpso12Id).html('TPSo12<br />-');
        return null;
      }

      const averageTime = lastTimes.reduce((a: number, b: number) => a + b, 0) / lastTimes.length;
      const avgTimeStr = averageTimeString(averageTime);
      $(avgId).html(`Average Time<br />${avgTimeStr !== '-' ? avgTimeStr + ' s' : '-'}`);

      const avgTPS = averageTime ? (moveCount / (averageTime / 1000)).toFixed(2) : '-';
      $(tpsId).html(`Average TPS<br />${avgTPS}`);

      const pbStr = best ? bestTimeString(best) + ' s' : '-';
      $(pbId).html(`Single PB<br />${pbStr}`);

      const ao12 = averageOf12TimeNumber(algId, prefix);
      const ao12Str = ao12 ? averageTimeString(ao12) + ' s' : '-';
      $(ao12Id).html(`Ao12<br />${ao12Str}`);
      const tpso12 = ao12 ? (moveCount / (ao12 / 1000)).toFixed(2) : '-';
      $(tpso12Id).html(`TPSo12<br />${tpso12}`);

      const canvas = document.getElementById(graphId) as HTMLCanvasElement;
      if (canvas) return createModalStatsGraph(canvas, lastTimes);
      return null;
    }

    // Check if there is any data for each section
    const stats_visible = getLastTimes(algId, '').length > 0;
    const cd_stats_visible = getLastTimes(algId, 'CD-').length > 0;

    // Hide/show sections and 'no data' message based on data availability
    if (stats_visible) {
      $('#stats-modal-exec').show();
    } else {
      $('#stats-modal-exec').hide();
    }
    if (cd_stats_visible) {
      $('#stats-modal-recexec').show();
    } else {
      $('#stats-modal-recexec').hide();
    }
    if (!stats_visible && !cd_stats_visible) {
      $('#stats-modal-no-data').show();
    } else {
      $('#stats-modal-no-data').hide();
    }

    // Use setTimeout to let the modal render before creating charts
    $('#stats-modal-overlay').removeClass('hidden');
    setTimeout(() => {
      if (stats_visible)
        S.modalExecChart = populateSection('', 'stats-modal-exec-graph', '#stats-modal-exec-avg', '#stats-modal-exec-tps', '#stats-modal-exec-pb', '#stats-modal-exec-ao12', '#stats-modal-exec-tpso12');
      if (cd_stats_visible)
        S.modalRecexecChart = populateSection('CD-', 'stats-modal-recexec-graph', '#stats-modal-recexec-avg', '#stats-modal-recexec-tps', '#stats-modal-recexec-pb', '#stats-modal-recexec-ao12', '#stats-modal-recexec-tpso12');
    }, 0);
  });

  // #stats-modal-close button - closes the statistics modal and destroys chart instances
  $('#stats-modal-close').on('click', () => {
    $('#stats-modal-overlay').addClass('hidden');
    if (S.modalExecChart) { S.modalExecChart.destroy(); S.modalExecChart = null; }
    if (S.modalRecexecChart) { S.modalRecexecChart.destroy(); S.modalRecexecChart = null; }
  });

  // #stats-modal-reset button - permanently deletes all timing data and stats for the displayed case
  $('#stats-modal-reset').on('click', () => {
    const algId = String($('#stats-modal-overlay').data('modalAlgId') || '');
    if (!algId) return;
    if (!confirm('Reset all stats for this case? This cannot be undone.')) return;
    localStorage.removeItem('LastTimes-' + algId);
    localStorage.removeItem('LastTimes-CD-' + algId);
    localStorage.removeItem('Best-' + algId);
    localStorage.removeItem('Best-CD-' + algId);
    localStorage.removeItem('FailedCount-' + algId);
    localStorage.removeItem('SuccessCount-' + algId);
    localStorage.removeItem('LastResults-' + algId);
    localStorage.removeItem('ConsecutiveCorrect-' + algId);
    // Update stats modal
    $('#stats-modal-success').html('');
    $('#stats-modal-failed').html('');
    $('#stats-modal-exec').hide();
    $('#stats-modal-recexec').hide();
    $('#stats-modal-no-data').show();
    if (S.modalExecChart) { S.modalExecChart.destroy(); S.modalExecChart = null; }
    if (S.modalRecexecChart) { S.modalRecexecChart.destroy(); S.modalRecexecChart = null; }
    // Redraw the tile in #alg-cases if it is currently shown
    $(`#best-time-${algId}`).text('Best: -');
    $(`#ao5-time-${algId}`).text('Ao5: -');
    $(`#${algId}-success`).html('');
    $(`#${algId}-failed`).html('');
    $(`#${algId}`).data('failed', 0);
    $(`#case-toggle-${algId}`).data('best', null);
    // Update the practice stats panel if this is the active case
    if (algToId(S.originalUserAlg.join(' ')) === algId) updateTimesDisplay();
    // Redraw tiles in #alg-cases to reflect cleared stats
    const category = $('#category-select').val()?.toString() || '';
    if (category) loadAlgorithms(category);
  });

  // #stats-modal-bookmark button - cycles learned status (unknown->learning->learned->unknown) from the modal
  $('#stats-modal-bookmark').on('click', () => {
    const algId = String($('#stats-modal-bookmark').attr('data-algid') || '');
    if (!algId) return;
    let status = learnedStatus(algId);
    status = (status + 1) % 3;
    localStorage.setItem('Learned-' + algId, status.toString());
    $('#stats-modal-bookmark').html(learnedSVG(status));
    $(`#bookmark-${algId}`).html(learnedSVG(status));
    $(`#last-tile-bookmark-${algId}`).html(learnedSVG(status));
    if (algToId(S.originalUserAlg.join(' ')) === algId) {
      $('#stats-bookmark-btn').html(learnedSVG(status));
    }
  });

  // #stats-modal-overlay background click - closes the modal when clicking outside the dialog content
  $('#stats-modal-overlay').on('click', function (e) {
    if (e.target === this) {
      $(this).addClass('hidden');
      if (S.modalExecChart) { S.modalExecChart.destroy(); S.modalExecChart = null; }
      if (S.modalRecexecChart) { S.modalRecexecChart.destroy(); S.modalRecexecChart = null; }
    }
  });
}

/**
 * AbjadNLP 2027 — shared-task registration forms (Shared Tasks 01–09).
 *
 * Run this ONCE while signed in to Google as research@elmoussa.ch:
 *   1. Open https://script.google.com  →  New project
 *   2. Replace the contents of Code.gs with this file and save
 *   3. Select the function `createAbjad2027Forms` and click Run
 *   4. Accept the permissions prompt (Drive + Forms)
 *   5. Open View → Logs (or "Execution log") to see every form's links
 *
 * What it creates in that account's My Drive:
 *   2026/                         (empty folder)
 *   2027/
 *     Abjad NLP 2027/
 *       ST01 AbjadGenEval 2027 - Registration Form
 *       ...
 *       ST09 TariQA 2027 - Registration Form
 *
 * Each form copies the structure of the DialectSentEval 2026 template:
 * six required contact/team fields, then an "Are you participating in"
 * checkbox listing one subtask per language (plus any extra track).
 *
 * It is safe to run again: existing folders are reused and a form whose
 * name already exists in the target folder is skipped, not duplicated.
 *
 * Source for tasks and languages: https://abjadnlp.com/abjad2027.html#tasks
 * and each task's "Shared-task site" page (language coverage / tracks),
 * read on 2026-11-08.
 */

var WOLOF = 'Wolofal-Abjad Wolof';

var TASKS = [
  {
    num: '01',
    name: 'AbjadGenEval',
    summary: 'AI-generated text detection in Modern Standard Arabic, Urdu and Persian.',
    site: 'https://abjadnlp.com/abjad2027/AbjadGenEval.html',
    subtasks: [
      'Arabic (MSA) — AI-generated text detection',
      'Urdu — AI-generated text detection',
      'Persian — AI-generated text detection',
      WOLOF + ' — AI-generated text detection',
      'Multilingual Abjad — unified detection system across all languages'
    ]
  },
  {
    num: '02',
    name: 'AbjadStyleTransfer',
    summary: 'Authorship style transfer for Urdu.',
    site: 'https://abjadnlp.com/abjad2027/AbjadStyleTransfer.html',
    subtasks: [
      'Urdu — Authorship style transfer'
    ]
  },
  {
    num: '03',
    name: 'AbjadAuthorID',
    summary: 'Multiclass authorship identification for Kurdish and Urdu.',
    site: 'https://abjadnlp.com/abjad2027/AbjadAuthorID.html',
    subtasks: [
      'Kurdish — Authorship identification',
      'Urdu — Authorship identification',
      WOLOF + ' — Authorship identification'
    ]
  },
  {
    num: '04',
    name: 'AbjadTranslit',
    summary: 'Bidirectional sentence-level transliteration between Arabizi and Arabic script.',
    site: 'https://abjadnlp.com/abjad2027/arabizi27.html',
    subtasks: [
      'Arabizi → Arabic script (Latin → Arabic transliteration)',
      'Arabic script → Arabizi (Arabic → Latin transliteration)'
    ]
  },
  {
    num: '05',
    name: 'AbjadSentEval',
    summary: 'Sentiment analysis across Arabic dialects and an additional Arabic-script language.',
    site: 'https://abjadnlp.com/abjad2027/AbjadSentEval.html',
    subtasks: [
      'Arabic dialects — Sentiment analysis',
      WOLOF + ' — Sentiment analysis'
    ]
  },
  {
    num: '06',
    name: 'AbjadStanceEval',
    summary: 'Stance detection towards specified targets, topics and claims in Arabic varieties.',
    site: 'https://abjadnlp.com/abjad2027/AbjadStanceEval.html',
    subtasks: [
      'Arabic (MSA and/or dialects) — Stance detection'
    ]
  },
  {
    num: '07',
    name: 'Abjad Cross-Dialect Translation',
    summary: 'Translation between Arabic dialects, with an emphasis on meaning preservation and naturalness.',
    site: 'https://abjadnlp.com/abjad2027/AbjadTranslation.html',
    subtasks: [
      'Arabic dialects — Cross-dialect translation',
      WOLOF + ' — Translation'
    ]
  },
  {
    num: '08',
    name: 'AbjadLanguageID',
    summary: 'Language and language-cluster identification across Arabic-script languages.',
    site: 'https://abjadnlp.com/abjad2027/AbjadLanguageID.html',
    subtasks: [
      'Arabic — Language identification',
      'Persian — Language identification',
      'Urdu — Language identification',
      'Kurdish — Language identification',
      'Ajami — Language identification',
      WOLOF + ' — Language identification',
      'Language-cluster identification (e.g. Magharibi, African, Gulf, Indian)'
    ]
  },
  {
    num: '09',
    name: 'TariQA',
    summary: 'Multiple-choice question answering on Moroccan traffic law.',
    site: 'https://abjadnlp.com/abjad2027/TariQA.html',
    subtasks: [
      'Modern Standard Arabic (MSA) — Traffic-law question answering',
      'Moroccan Darija — Traffic-law question answering'
    ]
  }
];

function createAbjad2027Forms() {
  var root = DriveApp.getRootFolder();
  getOrCreateFolder_(root, '2026');
  var year2027 = getOrCreateFolder_(root, '2027');
  var target = getOrCreateFolder_(year2027, 'Abjad NLP 2027');

  Logger.log('Target folder: ' + target.getUrl());

  TASKS.forEach(function (task) {
    var fileName = 'ST' + task.num + ' ' + task.name + ' 2027 - Registration Form';
    var existing = target.getFilesByName(fileName);
    if (existing.hasNext()) {
      var f = existing.next();
      Logger.log('SKIPPED (already exists): ' + fileName + '  ' + f.getUrl());
      return;
    }

    var form = FormApp.create(fileName);
    buildForm_(form, task);

    // FormApp.create puts the form in My Drive root; move it into the folder.
    DriveApp.getFileById(form.getId()).moveTo(target);

    Logger.log('CREATED: ' + fileName +
      '\n   edit:    ' + form.getEditUrl() +
      '\n   respond: ' + form.getPublishedUrl());
  });

  Logger.log('Done.');
}

function buildForm_(form, task) {
  form.setTitle(task.name + ' Shared Task 2027 - Registration Form');
  form.setDescription(
    'Welcome to the ' + task.name + ' 2027: Shared Task ' + task.num +
    ' at AbjadNLP 2027.\n' +
    task.summary + '\n' +
    'Task website: ' + task.site + '\n' +
    'After you register, you will receive an email with the details for participation.'
  );

  // Same fields, order and "required" flags as the DialectSentEval 2026 form.
  form.addTextItem().setTitle('Contact Person First Name').setRequired(true);
  form.addTextItem().setTitle('Contact Person Last Name').setRequired(true);
  form.addTextItem().setTitle('Affiliation').setRequired(true);
  form.addTextItem().setTitle('Contact Person (Email)').setRequired(true);
  form.addTextItem().setTitle('Team Name').setRequired(true);
  form.addParagraphTextItem()
    .setTitle('Team Members (first and last name of each member, comma separated)')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Are you participating in')
    .setChoiceValues(task.subtasks.map(function (label, i) {
      return 'Subtask ' + (i + 1) + ' — ' + label;
    }))
    .setRequired(false);
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

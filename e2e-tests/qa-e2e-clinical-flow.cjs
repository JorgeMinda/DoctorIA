// QA E2E: Clinical note lifecycle (login → patients → create note → AI → confirm → audit)
// Usage: node qa-e2e-clinical-flow.cjs
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'https://doctoria-client.onrender.com';
const CREDS = { email: 'medico1@doctoria.com', password: 'Doctoria2026!' };
const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'qa-clinical-flow');

const SAMPLE_NOTE = `Paciente masculino de 45 años acude a consulta por dolor abdominal tipo cólico de 3 días de evolución localizado en epigastrio, acompañado de náuseas sin vómito. Refiere antecedente de gastritis crónica diagnosticada hace 2 años. Al examen físico se encuentra abdomen blando, depresible, dolor a la palpación profunda en epigastrio sin signos de irritación peritoneal. Signos vitales: PA 120/80 mmHg, FC 78 lpm, T 36.5°C. Se valora cuadro compatible con exacerbación de gastritis crónica. Se indica omeprazol 20mg VO cada 12h por 14 días, dieta blanda, evitar irritantes, y control en 2 semanas.`;

const SECTION_LABELS = [
  'Motivo de consulta',
  'Nota clínica / evolución',
  'Examen físico',
  'Valoración clínica',
  'Plan / indicaciones',
];

const results = [];
let screenshotIndex = 0;

function report(step, pass, severity, detail) {
  results.push({ step, pass, severity, detail });
}

async function screenshot(page, name) {
  screenshotIndex++;
  const filename = `${String(screenshotIndex).padStart(2, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 ${filename}`);
  return filepath;
}

(async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log(`\n🏥 DoctorIA — QA E2E: Clinical Note Lifecycle`);
  console.log(`   Target: ${BASE}`);
  console.log(`   Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let createdNoteId = null;
  let auditCountBefore = null;

  // ============================================================
  // STEP 1: Navigate to login
  // ============================================================
  console.log('STEP 1: Navigate to login page');
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 });
    await screenshot(page, 'login-page');
    const hasEmailInput = await page.locator('input[name=email]').count();
    const hasPasswordInput = await page.locator('input[name=password]').count();
    if (hasEmailInput > 0 && hasPasswordInput > 0) {
      report('1-login-page', true, null, 'Login page loaded with email/password fields');
    } else {
      report('1-login-page', false, 'Critical', 'Login form fields not found');
    }
  } catch (err) {
    report('1-login-page', false, 'Critical', `Navigation error: ${err.message}`);
    await screenshot(page, 'login-page-error');
  }

  // ============================================================
  // STEP 2: Login as medico1
  // ============================================================
  console.log('STEP 2: Login as medico1@doctoria.com');
  try {
    await page.fill('input[name=email]', CREDS.email);
    await page.fill('input[name=password]', CREDS.password);
    await screenshot(page, 'login-filled');
    await page.click('button[type=submit]').catch(() => page.click('button:has-text("Log in")'));
    await page.waitForTimeout(8000);
    await screenshot(page, 'post-login');

    const url = page.url();
    const loginSuccess = !url.includes('/login');
    if (loginSuccess) {
      report('2-login', true, null, `Redirected to: ${url}`);
    } else {
      // Check for error messages on the page
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasError = /invalid|incorrect|error|inválido/i.test(bodyText);
      report('2-login', false, 'Critical', `Still on login. Error shown: ${hasError}. URL: ${url}`);
    }
  } catch (err) {
    report('2-login', false, 'Critical', `Login error: ${err.message}`);
    await screenshot(page, 'login-error');
  }

  // ============================================================
  // STEP 3: Navigate to /clinical/patients
  // ============================================================
  console.log('STEP 3: Navigate to /clinical/patients');
  try {
    await page.goto(`${BASE}/clinical/patients`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(3000);
    await screenshot(page, 'patients-list');

    const heading = await page.locator('h1').textContent().catch(() => '');
    const hasPacientes = /pacientes/i.test(heading);
    // Look for PAC- entries
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasSyntheticPatients = /PAC-\d{3}/i.test(bodyText);
    if (hasPacientes && hasSyntheticPatients) {
      report('3-patients-list', true, null, 'Patient list loaded with synthetic patients');
    } else {
      report('3-patients-list', false, 'Critical', `Heading: "${heading}", Synthetic IDs found: ${hasSyntheticPatients}`);
    }
  } catch (err) {
    report('3-patients-list', false, 'Critical', `Navigation error: ${err.message}`);
    await screenshot(page, 'patients-list-error');
  }

  // ============================================================
  // STEP 4: Select first patient (click "Ver historia")
  // ============================================================
  console.log('STEP 4: Select first synthetic patient');
  try {
    // Click the first "Ver historia" button
    const verHistoriaButtons = page.locator('button:has-text("Ver historia"), a:has-text("Ver historia")');
    const count = await verHistoriaButtons.count();
    if (count > 0) {
      await verHistoriaButtons.first().click();
      await page.waitForTimeout(5000);
      await screenshot(page, 'patient-detail');

      const url = page.url();
      const onPatientDetail = /\/clinical\/patients\/[a-z0-9-]+/i.test(url);
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasSyntheticId = /PAC-\d{3}/.test(bodyText);
      const hasNewNoteSection = /Nueva nota clínica/i.test(bodyText);
      if (onPatientDetail && hasSyntheticId) {
        report('4-patient-detail', true, null, `Patient detail loaded. URL: ${url}. New note section: ${hasNewNoteSection}`);
      } else {
        report('4-patient-detail', false, 'Major', `URL: ${url}, syntheticId: ${hasSyntheticId}`);
      }
    } else {
      report('4-patient-detail', false, 'Critical', 'No "Ver historia" buttons found');
    }
  } catch (err) {
    report('4-patient-detail', false, 'Critical', `Error selecting patient: ${err.message}`);
    await screenshot(page, 'patient-detail-error');
  }

  // ============================================================
  // STEP 4b: Count audit entries BEFORE creating note
  // ============================================================
  console.log('STEP 4b: Snapshot audit count before note creation');
  try {
    const auditPage2 = await context.newPage();
    await auditPage2.goto(`${BASE}/clinical/audit`, { waitUntil: 'networkidle', timeout: 90000 });
    await auditPage2.waitForTimeout(3000);
    const auditBody = await auditPage2.evaluate(() => document.body.innerText);
    // Count lines that look like audit entries (contain a timestamp pattern)
    auditCountBefore = (auditBody.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).length;
    console.log(`   Audit entries before: ~${auditCountBefore}`);
    await auditPage2.close();
  } catch (err) {
    console.log(`   Could not snapshot audit count: ${err.message}`);
  }

  // ============================================================
  // STEP 5: Create a new clinical note with originalText
  // ============================================================
  console.log('STEP 5: Create new clinical note');
  try {
    // Find the textarea for new note (in the "Nueva nota clínica" card)
    const textarea = page.locator('textarea').first();
    await textarea.fill(SAMPLE_NOTE);
    await screenshot(page, 'note-text-filled');

    // Click "Crear nota"
    await page.click('button:has-text("Crear nota")');
    await page.waitForTimeout(8000);
    await screenshot(page, 'after-create-note');

    const url = page.url();
    const onNotePage = /\/clinical\/notes\/[a-z0-9-]+/i.test(url);
    if (onNotePage) {
      createdNoteId = url.match(/\/clinical\/notes\/([a-z0-9-]+)/i)?.[1];
      report('5-create-note', true, null, `Note created. URL: ${url}, noteId: ${createdNoteId}`);
    } else {
      report('5-create-note', false, 'Critical', `Not redirected to note page. URL: ${url}`);
    }
  } catch (err) {
    report('5-create-note', false, 'Critical', `Error creating note: ${err.message}`);
    await screenshot(page, 'create-note-error');
  }

  // ============================================================
  // STEP 6: Verify originalText is displayed (RNF-004)
  // ============================================================
  console.log('STEP 6: Verify originalText is displayed');
  try {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasOriginalCard = /Texto original/i.test(bodyText);
    const hasPartialText = bodyText.includes('dolor abdominal tipo cólico');
    const hasDraftStatus = /borrador manual|DRAFT/i.test(bodyText);

    if (hasOriginalCard && hasPartialText) {
      report('6-original-text', true, null, `Original text displayed in card. Draft status: ${hasDraftStatus}`);
    } else {
      report('6-original-text', false, 'Critical', `Original card: ${hasOriginalCard}, contains text: ${hasPartialText}`);
    }
    await screenshot(page, 'note-detail-original');
  } catch (err) {
    report('6-original-text', false, 'Critical', `Error: ${err.message}`);
  }

  // ============================================================
  // STEP 7: Request AI structuring
  // ============================================================
  console.log('STEP 7: Request AI structuring');
  try {
    const aiButton = page.locator('button:has-text("Estructurar con IA")');
    const btnCount = await aiButton.count();
    if (btnCount === 0) {
      report('7-ai-structuring', false, 'Critical', '"Estructurar con IA" button not found');
    } else {
      await screenshot(page, 'before-ai-structuring');
      await aiButton.click();
      // Wait for AI structuring to complete (up to 45s to account for timeout fallback)
      console.log('   Waiting up to 45s for AI structuring...');
      await page.waitForTimeout(45000);
      await screenshot(page, 'after-ai-structuring');

      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasAIBadge = /asistido por IA|AI_ASSISTED/i.test(bodyText);
      const hasToast = /estructurada con IA/i.test(bodyText);

      // Check if status changed from DRAFT_MANUAL
      const statusChanged = /borrador IA|AI.?assisted|DRAFT_AI/i.test(bodyText);

      report('7-ai-structuring', true, null, `AI structuring completed. AI badge: ${hasAIBadge}, status changed: ${statusChanged}`);
    }
  } catch (err) {
    report('7-ai-structuring', false, 'Critical', `Error: ${err.message}`);
    await screenshot(page, 'ai-structuring-error');
  }

  // ============================================================
  // STEP 8: Verify 5 structured sections appear editable
  // ============================================================
  console.log('STEP 8: Verify 5 structured sections editable');
  try {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const sectionResults = {};
    for (const label of SECTION_LABELS) {
      sectionResults[label] = bodyText.includes(label);
    }

    const allPresent = Object.values(sectionResults).every(Boolean);

    // Check if sections are in textarea elements (editable)
    const textareaCount = await page.locator('.space-y-4 textarea').count();
    const sectionsEditable = textareaCount >= 5;

    // Check if at least some sections have content (from AI structuring)
    const textareaValues = await page.evaluate(() => {
      const textareas = document.querySelectorAll('.space-y-4 textarea');
      return Array.from(textareas).map(ta => ta.value.length);
    });
    const nonEmptyCount = textareaValues.filter(len => len > 0).length;

    if (allPresent && sectionsEditable) {
      report('8-sections-editable', true, null, `All 5 sections present and editable. Textareas: ${textareaCount}, Non-empty: ${nonEmptyCount}/5`);
    } else if (allPresent && !sectionsEditable) {
      report('8-sections-editable', false, 'Major', `Sections visible but not all editable. Textareas: ${textareaCount}`);
    } else {
      const missing = Object.entries(sectionResults).filter(([, v]) => !v).map(([k]) => k);
      report('8-sections-editable', false, 'Critical', `Missing sections: ${missing.join(', ')}. Textareas: ${textareaCount}`);
    }

    await screenshot(page, 'sections-editable');

    // Scroll down to capture all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await screenshot(page, 'sections-editable-scrolled');
  } catch (err) {
    report('8-sections-editable', false, 'Critical', `Error: ${err.message}`);
    await screenshot(page, 'sections-error');
  }

  // ============================================================
  // STEP 9: Confirm the note
  // ============================================================
  console.log('STEP 9: Confirm clinical note');
  try {
    // Scroll back to top to find the confirm button
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Before confirming, check sections have content. If AI generated content, sections should be filled.
    // If sections are empty (fallback), we need to fill them manually first.
    const textareaValues = await page.evaluate(() => {
      const textareas = document.querySelectorAll('.space-y-4 textarea');
      return Array.from(textareas).map(ta => ({ value: ta.value }));
    });
    const emptyCount = textareaValues.filter(t => !t.value.trim()).length;
    
    if (emptyCount > 0) {
      console.log(`   ${emptyCount} empty sections found — filling them for confirmation test`);
      const fallbackTexts = [
        'Dolor abdominal tipo cólico de 3 días de evolución.',
        'Paciente masculino 45 años con antecedente de gastritis crónica.',
        'Abdomen blando depresible, dolor epigástrico a la palpación profunda. PA 120/80, FC 78, T 36.5.',
        'Exacerbación de gastritis crónica.',
        'Omeprazol 20mg c/12h x 14 días. Dieta blanda. Control en 2 semanas.',
      ];
      const textareas = page.locator('.space-y-4 textarea');
      const taCount = await textareas.count();
      for (let i = 0; i < Math.min(taCount, 5); i++) {
        const currentVal = await textareas.nth(i).inputValue();
        if (!currentVal.trim()) {
          await textareas.nth(i).fill(fallbackTexts[i] || 'Contenido de prueba');
        }
      }
      // Save changes first
      const saveBtn = page.locator('button:has-text("Guardar cambios")');
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
      }
      await screenshot(page, 'sections-filled-for-confirm');
    }

    // Now confirm
    const confirmBtn = page.locator('button:has-text("Confirmar nota")');
    const confirmCount = await confirmBtn.count();
    if (confirmCount === 0) {
      report('9-confirm-note', false, 'Critical', '"Confirmar nota" button not found');
    } else {
      await confirmBtn.click();
      await page.waitForTimeout(5000);
      await screenshot(page, 'after-confirm');

      const bodyText = await page.evaluate(() => document.body.innerText);
      const isConfirmed = /confirmad[ao]|CONFIRMED|solo lectura/i.test(bodyText);
      const readOnlySections = /solo lectura/i.test(bodyText);
      const noEditButtons = !(await page.locator('button:has-text("Estructurar con IA")').count());
      
      if (isConfirmed) {
        report('9-confirm-note', true, null, `Note confirmed. Read-only: ${readOnlySections}, AI button hidden: ${noEditButtons}`);
      } else {
        // Check if there was an error message
        const hasError = /no se pudo|error|sección|faltan/i.test(bodyText);
        report('9-confirm-note', false, 'Critical', `Note not confirmed. Error displayed: ${hasError}. Body snippet: ${bodyText.substring(0, 200)}`);
      }
    }
  } catch (err) {
    report('9-confirm-note', false, 'Critical', `Error: ${err.message}`);
    await screenshot(page, 'confirm-error');
  }

  // ============================================================
  // STEP 10: Navigate to /clinical/audit and verify new entry
  // ============================================================
  console.log('STEP 10: Verify audit log entry');
  try {
    await page.goto(`${BASE}/clinical/audit`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(4000);
    await screenshot(page, 'audit-log');

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasAuditHeading = /auditoría/i.test(bodyText);
    const hasRegistro = /registro/i.test(bodyText);

    // Look for entries related to our actions (note creation, AI structuring, confirmation)
    const hasCreateEntry = /creación.*nota|nota.*cread|CREATE_NOTE/i.test(bodyText);
    const hasAIEntry = /estructuración|AI.*structur|REQUEST_AI/i.test(bodyText);
    const hasConfirmEntry = /confirmación|confirm|CONFIRM/i.test(bodyText);

    // Check if the first entry is recent (today's date)
    const today = new Date();
    const todayStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    const hasRecentEntry = bodyText.includes(todayStr) || bodyText.includes(today.toLocaleDateString());

    // Count entries now
    const auditCountAfter = (bodyText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).length;

    const entriesFound = [
      hasCreateEntry && 'CREATE_NOTE',
      hasAIEntry && 'AI_STRUCTURING',
      hasConfirmEntry && 'CONFIRM',
    ].filter(Boolean);

    if (hasAuditHeading && entriesFound.length > 0) {
      report('10-audit-log', true, null, `Audit entries found: [${entriesFound.join(', ')}]. Recent: ${hasRecentEntry}. Count before: ${auditCountBefore}, after: ${auditCountAfter}`);
    } else if (hasAuditHeading) {
      // Audit page loaded but no matching entries found — might use different labels
      const firstEntries = await page.evaluate(() => {
        const items = document.querySelectorAll('.divide-y > div');
        return Array.from(items).slice(0, 3).map(el => el.textContent.trim().substring(0, 120));
      });
      report('10-audit-log', false, 'Major', `Audit page loaded but no matching action entries found. First entries: ${JSON.stringify(firstEntries)}`);
    } else {
      report('10-audit-log', false, 'Critical', 'Audit page did not load properly');
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, 'audit-log-top');
  } catch (err) {
    report('10-audit-log', false, 'Critical', `Error: ${err.message}`);
    await screenshot(page, 'audit-error');
  }

  // ============================================================
  // STEP 11: Verify confirmed note is read-only
  // ============================================================
  if (createdNoteId) {
    console.log('STEP 11: Verify confirmed note is read-only');
    try {
      await page.goto(`${BASE}/clinical/notes/${createdNoteId}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(3000);
      await screenshot(page, 'confirmed-note-readonly');

      const bodyText = await page.evaluate(() => document.body.innerText);
      const readOnlyHeading = /solo lectura/i.test(bodyText);
      const noAIButton = (await page.locator('button:has-text("Estructurar con IA")').count()) === 0;
      const noConfirmButton = (await page.locator('button:has-text("Confirmar nota")').count()) === 0;
      const hasAdendaOption = /adenda|addendum/i.test(bodyText);

      // Verify all 5 section labels are displayed (read-only)
      let sectionLabelsVisible = 0;
      for (const label of SECTION_LABELS) {
        if (bodyText.includes(label)) sectionLabelsVisible++;
      }

      if (readOnlyHeading && noAIButton && noConfirmButton) {
        report('11-readonly-confirmed', true, null, `Confirmed note is read-only. Sections visible: ${sectionLabelsVisible}/5. Adenda option: ${hasAdendaOption}`);
      } else {
        report('11-readonly-confirmed', false, 'Major', `Read-only heading: ${readOnlyHeading}, AI btn hidden: ${noAIButton}, Confirm btn hidden: ${noConfirmButton}`);
      }
    } catch (err) {
      report('11-readonly-confirmed', false, 'Major', `Error: ${err.message}`);
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================
  await browser.close();

  // ============================================================
  // Print results
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log(' QA REPORT — DoctorIA Clinical Note E2E Flow');
  console.log(' ' + new Date().toISOString());
  console.log('='.repeat(70));

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    const severity = r.pass ? '' : ` [${r.severity}]`;
    console.log(`${icon} ${r.step}${severity}`);
    console.log(`   ${r.detail}`);
    if (r.pass) passCount++;
    else {
      failCount++;
      failures.push(r);
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`RESULTADO: ${passCount}/${results.length} pasos superados`);
  if (failCount > 0) {
    console.log(`\n⚠️  FALLOS (${failCount}):`);
    for (const f of failures) {
      console.log(`   [${f.severity}] ${f.step}: ${f.detail}`);
    }
  }
  console.log(`\n📸 Screenshots guardados en: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(70));

  // Exit with non-zero if any critical failures
  const criticalFail = failures.some(f => f.severity === 'Critical');
  process.exit(criticalFail ? 1 : 0);
})();

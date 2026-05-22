// ========== ДЛЯ ДЕЖУРКИ: РАБОТА С НЕСКОЛЬКИМИ МЕРАМИ ==========

// Хранилище для мер перед отправкой
let measuresList = [];

function addMeasureRow(measureData = null) {
    const container = document.getElementById('measuresContainer');
    const rowDiv = document.createElement('div');
    rowDiv.className = 'measure-row';
    rowDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;';

    rowDiv.innerHTML = `
        <select class="measure-select" style="flex: 1; padding: 8px;">
            <option value="">— Выберите меру —</option>
            <option value="Предупреждение" ${measureData?.measure === 'Предупреждение' ? 'selected' : ''}>Предупреждение</option>
            <option value="Выговор" ${measureData?.measure === 'Выговор' ? 'selected' : ''}>Выговор</option>
            <option value="Лишение премии" ${measureData?.measure === 'Лишение премии' ? 'selected' : ''}>Лишение премии</option>
            <option value="Увольнение" ${measureData?.measure === 'Увольнение' ? 'selected' : ''}>Увольнение</option>
            <option value="Благодарность" ${measureData?.measure === 'Благодарность' ? 'selected' : ''}>Благодарность</option>
            <option value="Премия" ${measureData?.measure === 'Премия' ? 'selected' : ''}>Премия</option>
        </select>
        <input type="text" placeholder="Новый вид" class="measure-type" style="flex: 1; padding: 8px;" value="${measureData?.new_type || ''}">
        <input type="url" placeholder="Ссылка на ошибку" class="measure-error" style="flex: 2; padding: 8px;" value="${measureData?.error_link || ''}">
        <button type="button" class="remove-measure-btn" style="background: #dc3545; padding: 8px 12px;" onclick="this.parentElement.remove()">✖️</button>
    `;

    container.insertBefore(rowDiv, container.lastElementChild);
}

// Добавляем первую пустую строку при загрузке
setTimeout(() => {
    if (document.getElementById('measuresContainer') && document.querySelectorAll('.measure-row').length <= 1) {
        addMeasureRow();
    }
}, 100);

// Функция сбора данных из мер
function collectMeasures() {
    const measures = [];
    document.querySelectorAll('#measuresContainer .measure-row:not(:last-child)').forEach(row => {
        const measure = row.querySelector('.measure-select')?.value;
        const new_type = row.querySelector('.measure-type')?.value;
        const error_link = row.querySelector('.measure-error')?.value;
        if (measure) {
            measures.push({ measure, new_type, error_link });
        }
    });
    return measures;
}

// Обновлённая функция добавления в дежурку
async function addDutyRecord(period, quantity, measuresArray) {
    const { error } = await sb.from('duty_room').insert([{
        period: period,
        quantity: parseInt(quantity),
        measures: JSON.stringify(measuresArray),  // сохраняем как JSON
        created_at: new Date().toISOString()
    }]);

    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return false;
    }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    loadRecords();
    return true;
}

// Обработчик кнопки добавления в дежурку
document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
    const period = document.getElementById('dutyPeriod').value.trim();
    const quantity = document.getElementById('dutyQuantity').value;
    const measuresArray = collectMeasures();

    if (!period || !quantity) {
        showMessage('❌ Заполните период и количество', 'error');
        return;
    }

    await addDutyRecord(period, quantity, measuresArray);

    // Очищаем форму
    document.getElementById('dutyPeriod').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('measuresContainer').innerHTML = '<div class="measure-row"><button type="button" class="add-measure-btn" onclick="addMeasureRow()">+ Добавить меру</button></div>';
    addMeasureRow(); // добавляем пустую строку
});

// Обновлённая функция отображения для дежурки
function renderDutyTable(data) {
    if (!data || data.length === 0) return '般<td colspan="3">Нет записей. Добавьте первую!</td></tr>';

    return data.map(record => {
        let measuresHtml = '';
        try {
            const measures = typeof record.measures === 'string' ? JSON.parse(record.measures) : record.measures;
            if (measures && measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    measures.map(m => `<li><strong>${m.measure || '—'}</strong>${m.new_type ? ` → ${m.new_type}` : ''}${m.error_link ? ` → <a href="${m.error_link}" target="_blank">ошибка</a>` : ''}</li>`).join('') +
                    '</ul>';
            }
        } catch(e) { measuresHtml = '<i>ошибка данных</i>'; }

        return `
            <tr>
                <td><strong>${record.id}</strong></td>
                <td>
                    📅 <strong>Период:</strong> ${record.period}<br>
                    🔢 <strong>Количество:</strong> ${record.quantity}<br>
                    📋 <strong>Меры:</strong> ${measuresHtml || '—'}
                 </td>
                <td>
                    <button class="edit-btn" onclick="editRecord(${record.id})">✏️ Изменить</button>
                    <button class="delete-btn" onclick="deleteRecord(${record.id})">🗑️ Удалить</button>
                 </td>
            </tr>
        `;
    }).join('');
}

// Добавляем фильтрацию по периодам
let currentFilter = '';

function applyFilter() {
    currentFilter = document.getElementById('filterPeriod')?.value.trim().toLowerCase() || '';
    loadRecords();
}

function clearFilter() {
    currentFilter = '';
    if (document.getElementById('filterPeriod')) document.getElementById('filterPeriod').value = '';
    loadRecords();
}

// Модифицируем loadRecords для поддержки фильтрации
// В функции loadRecords найдите блок с duty_room и измените запрос:

if (currentTable === 'duty_room') {
    let query = sb.from('duty_room').select('*').order('id', { ascending: false });
    if (currentFilter) {
        query = query.ilike('period', `%${currentFilter}%`);
    }
    const { data, error } = await query;
    // ... остальное
    tbody.innerHTML = renderDutyTable(data);
}

// Показываем/скрываем фильтр при переключении таблицы
function toggleFilterByTable(tableName) {
    const filterBlock = document.getElementById('periodFilterBlock');
    if (filterBlock) {
        filterBlock.style.display = tableName === 'duty_room' ? 'block' : 'none';
    }
}

// Добавьте в toggleFormByTable вызов этой функции
// и в switchTable тоже

// Обработчики фильтров
document.getElementById('applyFilterBtn')?.addEventListener('click', () => applyFilter());
document.getElementById('clearFilterBtn')?.addEventListener('click', () => clearFilter());
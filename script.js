// Создаём клиент Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('=== НАЧАЛО РАБОТЫ ===');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('supabase объект создан:', !!supabase);

// Ждём, пока загрузится страница
window.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена, ищем форму...');

    const form = document.getElementById('consultationForm');

    if (!form) {
        console.error('❌ Форма с id="consultationForm" не найдена!');
        return;
    }

    console.log('✅ Форма найдена, привязываю обработчик...');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('=== ФОРМА ОТПРАВЛЕНА ===');

        // Получаем данные из полей
        const dateInput = document.getElementById('date');
        const linkInput = document.getElementById('link');
        const commentInput = document.getElementById('comment');

        const date = dateInput ? dateInput.value : null;
        const link = linkInput ? linkInput.value : null;
        const comment = commentInput ? commentInput.value : null;

        console.log('Дата:', date);
        console.log('Ссылка:', link);
        console.log('Комментарий:', comment);

        // Проверяем, что поля заполнены
        if (!date || !link) {
            console.error('❌ Не все поля заполнены');
            alert('Заполните дату и ссылку');
            return;
        }

        // Пробуем отправить в Supabase
        console.log('🟢 Отправляю запрос в Supabase...');

        try {
            const { data, error } = await supabase
                .from('Consultation_scenario')
                .insert([
                    {
                        date: date,
                        link: link,
                        comment: comment || null
                    }
                ]);

            if (error) {
                console.error('🔴 Ошибка от Supabase:', error);
                alert('Ошибка: ' + error.message);
            } else {
                console.log('🟢 Успешно! Данные:', data);
                alert('Запись добавлена!');
                form.reset();
                // Перезагружаем список
                if (typeof loadRecords === 'function') {
                    loadRecords();
                }
            }
        } catch (err) {
            console.error('🔴 Исключение:', err);
            alert('Ошибка при отправке: ' + err.message);
        }
    });

    console.log('✅ Обработчик привязан, форма готова');
});
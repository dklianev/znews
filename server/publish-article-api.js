import fs from 'fs';

const content = `<p>Градът ни се управлява не от закона, а от хора с костюми и връзки в сенките.</p><br><p><strong>Raphael Ragucci</strong> – уважаван общински съветник, публично лице на &ldquo;реда&rdquo; и &ldquo;развитието&rdquo; в Los Santos – всъщност дърпа конците на престъпна структура, която държи наркотрафика под контрол.</p><br><h3>Не хаотичен. Не уличен. Организиран.</h3><p>Човекът, който върши мръсната работа, се казва <strong>Alfonso Silencio</strong>.</p><p>Alfonso е добре познат на целия ъндърграунд в Los Santos, като човека, през чийто ръце са минали стотици килограми марихуана.</p><p>На всички им е добре познато, че дори му беше направена акция при която според слухове са иззели видове марихуана, които никой не е виждал до сега на пазара. Този човек е безкрупулен, добре организиран и виновен за много престрелки, свръхдози и куп други нередности в нашия град.</p><p>Това само потвърждава, че този човек, ако наистина е зад гърба на Ragucci то това означава, че именно той държи пазара.</p><br><h3>Ragucci ръководи организирана престъпна група, която се занимава със:</h3><ul><li>засаждане и отглеждане на висококачествена марихуана</li><li>разпространение чрез добре координирана мрежа от дилъри</li><li>рекет и обири</li></ul><br><h3>Това не е квартален дилър. Това е индустрия.</h3><p>Плантациите са извън града. Складовете са прикрити.</p><p>Никой не говори. Защо?</p><p>Защото проверките спират. Защото сигнали изчезват.</p><p>Защото хората, които задават въпроси, внезапно млъкват. Нарко дилъри управляват този град.</p><p>Те не стоят по ъглите.</p><p>Те стоят в офисите. Los Santos има проблем. И той носи костюм.</p><br><h3>Разследвайте Ragucci. Проследете връзките му със Silencio.</h3><p>Проследете бизнеса, земите извън града, финансовите потоци. Ако публикувате това, бъдете внимателни.</p><p><strong>Те са опасни. И контролират повече, отколкото си мислите.</strong></p><br><p><em>ИСКРЕНО ВАШ - АНОНИМЕН ПОДАТЕЛ И ПОТЪРПЕВШ</em></p>`;

async function publishArticle() {
    try {
        console.log('Logging in with placeholder password...');
        let loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        let loginData = await loginRes.json();
        if (!loginData.token) {
            console.log('Failed to login with default admin123. Trying production password...');
            loginRes = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'JJyMEiPtPB_BfGLp6CiuCG6o'
                })
            });
            loginData = await loginRes.json();
        }

        if (!loginData.token) {
            console.error('Failed to login completely:', loginData);
            process.exit(1);
        }

        const token = loginData.token;
        console.log('Login successful, token retrieved.');

        console.log('Publishing article...');
        const articleRes = await fetch('http://localhost:3001/api/articles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Това не е слух. Това е предупреждение.',
                excerpt: 'Градът ни се управлява не от закона, а от хора с костюми и връзки в сенките. Raphael Ragucci всъщност дърпа конците на престъпна структура.',
                content: content,
                category: 'underground',
                status: 'published',
                authorId: 1, // Using admin
                featured: true,
                breaking: true,
                date: new Date().toLocaleDateString('bg-BG')
            })
        });

        const articleData = await articleRes.json();
        if (articleData.message) {
            console.log('SUCCESS:', articleData.message);
        } else {
            console.log('RESULT:', articleData);
        }

    } catch (err) {
        console.error('Caught error:', err);
    }
}

publishArticle();

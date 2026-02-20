import mongoose from 'mongoose';
import { Article } from './models.js';
import 'dotenv/config';

const uri = String(process.env.MONGODB_URI || '').trim();
const isPlaceholder = !uri || /YOUR_PASSWORD|xxxxx|user:password/i.test(uri);

async function run() {
    try {
        if (isPlaceholder) {
            throw new Error('Set MONGODB_URI to a real MongoDB connection string before running this script.');
        }

        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const lastArticle = await Article.findOne().sort('-id');
        const newId = lastArticle ? lastArticle.id + 1 : 1;

        const content = `<p>Градът ни се управлява не от закона, а от хора с костюми и връзки в сенките.</p><br><p><strong>Raphael Ragucci</strong> – уважаван общински съветник, публично лице на &ldquo;реда&rdquo; и &ldquo;развитието&rdquo; в Los Santos – всъщност дърпа конците на престъпна структура, която държи наркотрафика под контрол.</p><br><h3>Не хаотичен. Не уличен. Организиран.</h3><p>Човекът, който върши мръсната работа, се казва <strong>Alfonso Silencio</strong>.</p><p>Alfonso е добре познат на целия ъндърграунд в Los Santos, като човека, през чийто ръце са минали стотици килограми марихуана.</p><p>На всички им е добре познато, че дори му беше направена акция при която според слухове са иззели видове марихуана, които никой не е виждал до сега на пазара. Този човек е безкрупулен, добре организиран и виновен за много престрелки, свръхдози и куп други нередности в нашия град.</p><p>Това само потвърждава, че този човек, ако наистина е зад гърба на Ragucci то това означава, че именно той държи пазара.</p><br><h3>Ragucci ръководи организирана престъпна група, която се занимава със:</h3><ul><li>засаждане и отглеждане на висококачествена марихуана</li><li>разпространение чрез добре координирана мрежа от дилъри</li><li>рекет и обири</li></ul><br><h3>Това не е квартален дилър. Това е индустрия.</h3><p>Плантациите са извън града. Складовете са прикрити.</p><p>Никой не говори. Защо?</p><p>Защото проверките спират. Защото сигнали изчезват.</p><p>Защото хората, които задават въпроси, внезапно млъкват. Нарко дилъри управляват този град.</p><p>Те не стоят по ъглите.</p><p>Те стоят в офисите. Los Santos има проблем. И той носи костюм.</p><br><h3>Разследвайте Ragucci. Проследете връзките му със Silencio.</h3><p>Проследете бизнеса, земите извън града, финансовите потоци. Ако публикувате това, бъдете внимателни.</p><p><strong>Те са опасни. И контролират повече, отколкото си мислите.</strong></p><br><p><em>ИСКРЕНО ВАШ - АНОНИМЕН ПОДАТЕЛ И ПОТЪРПЕВШ</em></p>`;

        const dateStr = new Date().toLocaleDateString('bg-BG');
        const readTime = Math.ceil(content.split(' ').length / 200);

        const art = new Article({
            id: newId,
            title: 'Това не е слух. Това е предупреждение.',
            excerpt: 'Градът ни се управлява не от закона, а от хора с костюми и връзки в сенките. Raphael Ragucci всъщност дърпа конците на престъпна структура.',
            content,
            category: 'underground', // Putting it in "Underground" (Подземен свят) as it fits best, or "news"
            authorId: 0, // 0 usually for system/anonymous, wait, let's use 1 if author 0 doesn't exist
            date: dateStr,
            readTime,
            status: 'published',
            featured: true,
            breaking: true,
            tags: ['Рафаел Рагучи', 'Los Santos', 'Подземен свят', 'Престъпност']
        });

        await art.save();
        console.log('Successfully inserted anonymous tip article! ID:', newId);
    } catch (err) {
        console.error('Error inserting:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();

const db = require('./database.js');

setTimeout(() => {
    db.serialize(() => {
        db.run(`INSERT OR IGNORE INTO users (name, email, password) VALUES ('Usuário Demo', 'admin@admin.com', '123456')`, function(err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Usuário cadastrado com sucesso!');
            }
            process.exit();
        });
    });
}, 500);

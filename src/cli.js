const fs = require('fs');
const urdf = require('urdf');
const sttl = require('../src/sttl.js');

const msg = '\
Usage: render [options]\n\
Options:\n\
\t-i <file1> <file2> ...\n\
\t\tLoads all files in the renderer\'s RDF store.\n\
\t-o <file>\n\
\t\tSaves the rendered template in <file>.\n\
\t-t <file1> <file2> ...\n\
\t\tRegisters all template files for rendering.\n\
\t-c <uri>\n\
\t\tCalls st:call-template(<uri>) (default: :main).\n\
\t-h\n\
\t\tPrint this help message and exit.\n';

let args = process.argv;

if (args[0].endsWith('/node') && args[1].endsWith('.js')) args = args.splice(2);
else if (args[0].endsWith('/npm') && args[1] == 'run' && args[2] == 'render') args = args.splice(3);

if (args.indexOf('-h') > -1) {
    console.log(msg);
    return;
}

const spec = {};
for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (!arg.startsWith('-')) {
        console.log(msg);
        return; 
    } else {
        let o = arg.substring(1);
        spec[o] = [];
        for (; i + 1 < args.length && !args[i + 1].startsWith('-'); i++) {
            spec[o].push(args[i + 1]);
        }
    }
}

Promise.resolve()

.then(() => {
    if (spec.i) {
        return spec.i
        .map(f => fs.readFileSync(f, 'utf-8'))
        .reduce((p, rdf) => {
            return p.then(() => urdf.load(rdf)); // TODO file format
        }, Promise.resolve());
    }
})

.then(() => {
    if (spec.t) {
        return spec.t
        .map(f => fs.readFileSync(f, 'utf-8'))
        .reduce((p, sparql) => {
            return p.then(() => sttl.register(sparql));
        }, Promise.resolve());
    }
})

.then(() => {
    sttl.connect(q => {
        return urdf.query(q)
        .then(b => ({ results: { bindings: b }}))
    });
})

.then(() => {
    let tpl = (spec.c || ['https://github.com/vcharpenay/sttl.js/#main'])[0];
    return sttl.callTemplate(tpl);
})

.then(txt => {
    if (spec.o) fs.writeFileSync(spec.o[0], txt);
    else console.log(txt);
})

.catch(e => console.error(e));
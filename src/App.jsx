import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  Users, BookOpen, FileText, Calendar, LogOut, Plus, Check, AlertTriangle,
  Trash2, ChevronRight, User, Settings, BarChart3, X, Building2,
  Infinity as InfinityIcon, Download, Printer, Loader2,
} from 'lucide-react';

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().split('T')[0];

const intestatarioLabel = (data, contratto) => {
  if (!contratto) return '—';
  if (contratto.tipo_intestatario === 'ente') {
    const e = data.enti.find(x => x.id === contratto.ente_id);
    return e?.ragione_sociale || '—';
  }
  const a = data.allievi.find(x => x.id === contratto.allievo_id);
  return a ? `${a.nome} ${a.cognome}` : '—';
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profilo, setProfilo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfilo(null); return; }
    supabase.from('profili').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (error) console.error('Errore fetch profilo:', error);
        else setProfilo(data);
      });
  }, [session]);

  if (loading) return <FullScreenLoader text="Caricamento..." />;
  if (!session) return <Login />;
  if (!profilo) return <FullScreenLoader text="Caricamento profilo..." />;

  return <AppLogged session={session} profilo={profilo} />;
}

function FullScreenLoader({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
        <p className="text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">A</div>
          <h1 className="text-2xl font-bold text-slate-800">Ideabili - Gestione Corsi</h1>
          <p className="text-slate-500 text-sm">Accedi al tuo account</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Accedi
          </button>
        </div>
      </div>
    </div>
  );
}

function AppLogged({ session, profilo }) {
  const [data, setData] = useState({ istruttori: [], servizi: [], allievi: [], enti: [], contratti: [], lezioni: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');
  const [selectedAllievoId, setSelectedAllievoId] = useState(null);
  const [selectedEnteId, setSelectedEnteId] = useState(null);

  const isAdmin = profilo.ruolo === 'admin';

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [istr, srv, all, ent, ctr, lez] = await Promise.all([
      supabase.from('istruttori').select('*').order('cognome'),
      supabase.from('servizi').select('*').order('nome'),
      supabase.from('allievi').select('*').order('cognome'),
      supabase.from('enti').select('*').order('ragione_sociale'),
      supabase.from('contratti').select('*').order('codice'),
      supabase.from('lezioni').select('*').order('data', { ascending: false }),
    ]);
    setData({
      istruttori: istr.data || [], servizi: srv.data || [], allievi: all.data || [],
      enti: ent.data || [], contratti: ctr.data || [], lezioni: lez.data || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (loading) return <FullScreenLoader text="Caricamento dati..." />;

  const currentUser = {
    id: session.user.id,
    email: session.user.email,
    nome: profilo.nome,
    cognome: profilo.cognome,
    role: profilo.ruolo,
    istruttoreId: profilo.istruttore_id,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <div>
              <h1 className="font-bold text-slate-800">ASD Lezioni</h1>
              <p className="text-xs text-slate-500">{currentUser.nome} {currentUser.cognome} · {isAdmin ? 'Admin' : 'Istruttore'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-600 hover:text-slate-800 flex items-center gap-1.5 text-sm">
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <NavBtn active={view === 'home'} onClick={() => { setView('home'); setSelectedAllievoId(null); setSelectedEnteId(null); }} icon={<BookOpen className="w-4 h-4" />}>Home</NavBtn>
          <NavBtn active={view === 'registra'} onClick={() => setView('registra')} icon={<Plus className="w-4 h-4" />}>Registra lezione</NavBtn>
          <NavBtn active={view === 'allievi'} onClick={() => { setView('allievi'); setSelectedAllievoId(null); }} icon={<Users className="w-4 h-4" />}>Allievi</NavBtn>
          <NavBtn active={view === 'enti'} onClick={() => { setView('enti'); setSelectedEnteId(null); }} icon={<Building2 className="w-4 h-4" />}>Enti</NavBtn>
          <NavBtn active={view === 'report'} onClick={() => setView('report')} icon={<BarChart3 className="w-4 h-4" />}>Report istruttore</NavBtn>
          {isAdmin && <NavBtn active={view === 'admin'} onClick={() => setView('admin')} icon={<Settings className="w-4 h-4" />}>Gestione</NavBtn>}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {view === 'home' && <Home data={data} currentUser={currentUser} setView={setView} />}
        {view === 'registra' && <RegistraLezione data={data} reload={loadAll} currentUser={currentUser} />}
        {view === 'allievi' && !selectedAllievoId && <ListaAllievi data={data} currentUser={currentUser} onSelect={setSelectedAllievoId} />}
        {view === 'allievi' && selectedAllievoId && <SchedaAllievo data={data} reload={loadAll} allievoId={selectedAllievoId} currentUser={currentUser} onBack={() => setSelectedAllievoId(null)} />}
        {view === 'enti' && !selectedEnteId && <ListaEnti data={data} currentUser={currentUser} onSelect={setSelectedEnteId} />}
        {view === 'enti' && selectedEnteId && <SchedaEnte data={data} reload={loadAll} enteId={selectedEnteId} currentUser={currentUser} onBack={() => setSelectedEnteId(null)} />}
        {view === 'report' && <ReportIstruttore data={data} currentUser={currentUser} />}
        {view === 'admin' && isAdmin && <AdminPanel data={data} reload={loadAll} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${
        active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
      {icon}{children}
    </button>
  );
}

function Home({ data, currentUser, setView }) {
  const isAdmin = currentUser.role === 'admin';
  const myIstruttoreId = currentUser.istruttoreId;

  const myContratti = useMemo(() => {
    if (isAdmin) return data.contratti.filter(c => c.stato === 'aperto');
    return data.contratti.filter(c => c.stato === 'aperto' &&
      (c.istruttore_titolare_id === myIstruttoreId || c.istruttore_sostituto_id === myIstruttoreId));
  }, [data.contratti, isAdmin, myIstruttoreId]);

  const lezioniOggi = useMemo(() => {
    const today = todayISO();
    return data.lezioni.filter(l => l.data === today && (isAdmin || l.istruttore_id === myIstruttoreId));
  }, [data.lezioni, isAdmin, myIstruttoreId]);

  const contrattiAllievo = myContratti.filter(c => c.tipo_intestatario === 'allievo');
  const contrattiEnte = myContratti.filter(c => c.tipo_intestatario === 'ente');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Ciao {currentUser.nome} 👋</h2>
        <p className="text-slate-500">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Stat label="Contratti allievi" value={contrattiAllievo.length} icon={<Users />} color="indigo" />
        <Stat label="Contratti enti" value={contrattiEnte.length} icon={<Building2 />} color="purple" />
        <Stat label="Lezioni oggi" value={lezioniOggi.length} icon={<Calendar />} color="emerald" />
        <Stat label="Allievi attivi" value={new Set(contrattiAllievo.map(c => c.allievo_id)).size} icon={<User />} color="amber" />
      </div>
      <button onClick={() => setView('registra')}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-3 mb-6">
        <Plus className="w-6 h-6" /> Registra una lezione
      </button>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Lezioni di oggi</h3>
        {lezioniOggi.length === 0 ? <p className="text-sm text-slate-500">Nessuna lezione registrata oggi.</p> : (
          <div className="space-y-2">
            {lezioniOggi.map(l => {
              const c = data.contratti.find(x => x.id === l.contratto_id);
              const s = data.servizi.find(x => x.id === c?.servizio_id);
              const isEnte = c?.tipo_intestatario === 'ente';
              return (
                <div key={l.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {isEnte ? <Building2 className="w-4 h-4 text-purple-600" /> : <User className="w-4 h-4 text-indigo-600" />}
                    <span className="font-medium text-slate-800">{intestatarioLabel(data, c)}</span>
                    <span className="text-slate-500 text-sm">· {s?.nome}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, color }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700', purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
      <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-800">{value}</p></div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>{React.cloneElement(icon, { className: 'w-5 h-5' })}</div>
    </div>
  );
}

function RegistraLezione({ data, reload, currentUser }) {
  const isAdmin = currentUser.role === 'admin';
  const myIstruttoreId = currentUser.istruttoreId;

  const [tipo, setTipo] = useState(null);
  const [intestatarioId, setIntestatarioId] = useState('');
  const [contrattoId, setContrattoId] = useState('');
  const [istruttoreId, setIstruttoreId] = useState(myIstruttoreId || (data.istruttori.find(i => i.attivo)?.id ?? ''));
  const [dataLezione, setDataLezione] = useState(todayISO());
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTipo(null); setIntestatarioId(''); setContrattoId(''); setNote('');
    setDataLezione(todayISO()); setSearch(''); setError('');
  };

  const contrattiVisibili = useMemo(() => data.contratti.filter(c =>
    c.stato === 'aperto' && (isAdmin || c.istruttore_titolare_id === myIstruttoreId || c.istruttore_sostituto_id === myIstruttoreId)
  ), [data.contratti, isAdmin, myIstruttoreId]);

  const intestatariVisibili = useMemo(() => {
    if (tipo === 'allievo') {
      const ids = new Set(contrattiVisibili.filter(c => c.tipo_intestatario === 'allievo').map(c => c.allievo_id));
      return data.allievi.filter(a => ids.has(a.id)).map(a => ({ id: a.id, label: `${a.nome} ${a.cognome}`, sub: a.email }));
    }
    if (tipo === 'ente') {
      const ids = new Set(contrattiVisibili.filter(c => c.tipo_intestatario === 'ente').map(c => c.ente_id));
      return data.enti.filter(e => ids.has(e.id)).map(e => ({ id: e.id, label: e.ragione_sociale, sub: e.referente }));
    }
    return [];
  }, [tipo, contrattiVisibili, data.allievi, data.enti]);

  const intestatariFiltrati = useMemo(() => {
    if (!search) return intestatariVisibili;
    const s = search.toLowerCase();
    return intestatariVisibili.filter(x => x.label.toLowerCase().includes(s));
  }, [intestatariVisibili, search]);

  const contrattiIntestatario = useMemo(() => {
    if (!intestatarioId || !tipo) return [];
    return contrattiVisibili.filter(c => c.tipo_intestatario === tipo &&
      (tipo === 'allievo' ? c.allievo_id === intestatarioId : c.ente_id === intestatarioId));
  }, [contrattiVisibili, intestatarioId, tipo]);

  useEffect(() => {
    if (contrattiIntestatario.length === 1) setContrattoId(contrattiIntestatario[0].id);
    else setContrattoId('');
  }, [intestatarioId, contrattiIntestatario.length]);

  const contrattoSel = data.contratti.find(c => c.id === contrattoId);
  const isEnteContratto = contrattoSel?.tipo_intestatario === 'ente';
  const lezioniErogate = data.lezioni.filter(l => l.contratto_id === contrattoId).length;
  const lezioniResidue = (contrattoSel && !isEnteContratto) ? contrattoSel.lezioni_totali - lezioniErogate : null;
  const warning = !isEnteContratto && contrattoSel && lezioniResidue <= 0;

  const handleSubmit = async () => {
    if (!contrattoId || !dataLezione || !istruttoreId) return;
    setSaving(true); setError('');
    const { error } = await supabase.from('lezioni').insert({
      contratto_id: contrattoId, data: dataLezione, istruttore_id: istruttoreId,
      note: note || null, created_by: currentUser.id,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    await reload();
    setTimeout(() => { reset(); setSuccess(false); }, 1500);
  };

  if (success) return (
    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-12 text-center">
      <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="w-10 h-10 text-white" />
      </div>
      <h3 className="text-xl font-bold text-emerald-800">Lezione registrata!</h3>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Registra lezione</h2>
      <p className="text-slate-500 mb-6">Seleziona tipo, intestatario, contratto e data</p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <label className="text-sm font-semibold text-slate-700 mb-2 block">1. Tipo di lezione</label>
        {!tipo ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTipo('allievo')} className="p-4 border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 rounded-xl text-left transition">
              <User className="w-6 h-6 text-indigo-600 mb-2" />
              <div className="font-semibold text-slate-800">Allievo</div>
              <div className="text-xs text-slate-500">Lezione individuale su abbonamento</div>
            </button>
            <button onClick={() => setTipo('ente')} className="p-4 border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl text-left transition">
              <Building2 className="w-6 h-6 text-purple-600 mb-2" />
              <div className="font-semibold text-slate-800">Ente</div>
              <div className="text-xs text-slate-500">Lezione collettiva, senza limite</div>
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-between rounded-lg p-3 ${tipo === 'ente' ? 'bg-purple-50' : 'bg-indigo-50'}`}>
            <div className="flex items-center gap-2">
              {tipo === 'ente' ? <Building2 className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-indigo-600" />}
              <span className={`font-semibold ${tipo === 'ente' ? 'text-purple-900' : 'text-indigo-900'}`}>
                {tipo === 'ente' ? 'Lezione per Ente' : 'Lezione per Allievo'}
              </span>
            </div>
            <button onClick={reset}><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {tipo && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
          <label className="text-sm font-semibold text-slate-700 mb-2 block">2. {tipo === 'ente' ? 'Ente' : 'Allievo'}</label>
          {!intestatarioId ? (
            <>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cerca ${tipo === 'ente' ? 'ente' : 'allievo'}...`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {intestatariFiltrati.map(x => (
                  <button key={x.id} onClick={() => setIntestatarioId(x.id)}
                    className="px-3 py-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-left transition">
                    <div className="font-medium text-slate-800 text-sm">{x.label}</div>
                    {x.sub && <div className="text-xs text-slate-500">{x.sub}</div>}
                  </button>
                ))}
                {intestatariFiltrati.length === 0 && <p className="col-span-full text-sm text-slate-500 py-4 text-center">Nessun risultato</p>}
              </div>
            </>
          ) : (
            <div className={`flex items-center justify-between rounded-lg p-3 ${tipo === 'ente' ? 'bg-purple-50' : 'bg-indigo-50'}`}>
              <div className="flex items-center gap-2">
                {tipo === 'ente' ? <Building2 className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-indigo-600" />}
                <span className={`font-semibold ${tipo === 'ente' ? 'text-purple-900' : 'text-indigo-900'}`}>
                  {tipo === 'ente'
                    ? data.enti.find(e => e.id === intestatarioId)?.ragione_sociale
                    : `${data.allievi.find(a => a.id === intestatarioId)?.nome} ${data.allievi.find(a => a.id === intestatarioId)?.cognome}`}
                </span>
              </div>
              <button onClick={() => { setIntestatarioId(''); setContrattoId(''); }}><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      {intestatarioId && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
          <label className="text-sm font-semibold text-slate-700 mb-2 block">3. Servizio</label>
          {contrattiIntestatario.length === 0 ? <p className="text-sm text-red-600">Nessun contratto aperto.</p> : (
            <div className="space-y-2">
              {contrattiIntestatario.map(c => {
                const s = data.servizi.find(x => x.id === c.servizio_id);
                const erogate = data.lezioni.filter(l => l.contratto_id === c.id).length;
                const isEnte = c.tipo_intestatario === 'ente';
                const residue = isEnte ? null : c.lezioni_totali - erogate;
                const selected = contrattoId === c.id;
                return (
                  <button key={c.id} onClick={() => setContrattoId(c.id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{s?.nome}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          {isEnte ? <><InfinityIcon className="w-3 h-3" /> {erogate} lezioni erogate (illimitato)</> : <>{erogate}/{c.lezioni_totali} lezioni · {residue} residue</>}
                        </div>
                      </div>
                      {selected && <Check className="w-5 h-5 text-indigo-600" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {contrattoId && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
          <label className="text-sm font-semibold text-slate-700 mb-2 block">4. Dettagli</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Data</label>
              <input type="date" value={dataLezione} onChange={(e) => setDataLezione(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Istruttore che eroga</label>
              <select value={istruttoreId} onChange={(e) => setIstruttoreId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!isAdmin}>
                {data.istruttori.filter(i => i.attivo).map(i => <option key={i.id} value={i.id}>{i.nome} {i.cognome}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-600 mb-1 block">Note (facoltative)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={isEnteContratto ? "Es. classe 5ª A, gruppo del lunedì..." : "Es. sostituzione, recupero..."}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {warning && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-sm text-amber-800"><strong>Attenzione:</strong> il contratto ha esaurito le lezioni previste. Puoi comunque registrare ma considera di rinnovarlo.</div>
            </div>
          )}
          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <button onClick={handleSubmit} disabled={saving}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Conferma registrazione
          </button>
        </div>
      )}
    </div>
  );
}

function ListaAllievi({ data, currentUser, onSelect }) {
  const isAdmin = currentUser.role === 'admin';
  const myIstruttoreId = currentUser.istruttoreId;
  const [search, setSearch] = useState('');

  const allieviVisibili = useMemo(() => {
    if (isAdmin) return data.allievi;
    const ids = new Set(data.contratti.filter(c => c.tipo_intestatario === 'allievo' &&
      (c.istruttore_titolare_id === myIstruttoreId || c.istruttore_sostituto_id === myIstruttoreId)).map(c => c.allievo_id));
    return data.allievi.filter(a => ids.has(a.id));
  }, [data, isAdmin, myIstruttoreId]);

  const filtrati = allieviVisibili.filter(a => `${a.nome} ${a.cognome}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Allievi</h2>
      <p className="text-slate-500 mb-4">{allieviVisibili.length} {isAdmin ? 'totali' : 'tuoi'}</p>
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..."
        className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtrati.map((a, idx) => {
          const contrattiAperti = data.contratti.filter(c => c.tipo_intestatario === 'allievo' && c.allievo_id === a.id && c.stato === 'aperto').length;
          return (
            <button key={a.id} onClick={() => onSelect(a.id)}
              className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-semibold">{a.nome[0]}{a.cognome[0]}</div>
                <div>
                  <div className="font-medium text-slate-800">{a.nome} {a.cognome}</div>
                  <div className="text-xs text-slate-500">{contrattiAperti} contratti aperti</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListaEnti({ data, currentUser, onSelect }) {
  const isAdmin = currentUser.role === 'admin';
  const myIstruttoreId = currentUser.istruttoreId;
  const [search, setSearch] = useState('');

  const entiVisibili = useMemo(() => {
    if (isAdmin) return data.enti;
    const ids = new Set(data.contratti.filter(c => c.tipo_intestatario === 'ente' &&
      (c.istruttore_titolare_id === myIstruttoreId || c.istruttore_sostituto_id === myIstruttoreId)).map(c => c.ente_id));
    return data.enti.filter(e => ids.has(e.id));
  }, [data, isAdmin, myIstruttoreId]);

  const filtrati = entiVisibili.filter(e => e.ragione_sociale.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Enti</h2>
      <p className="text-slate-500 mb-4">{entiVisibili.length} {isAdmin ? 'totali' : 'tuoi'}</p>
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..."
        className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtrati.length === 0 && <p className="p-4 text-sm text-slate-500">Nessun ente.</p>}
        {filtrati.map((e, idx) => {
          const contrattiAperti = data.contratti.filter(c => c.tipo_intestatario === 'ente' && c.ente_id === e.id && c.stato === 'aperto').length;
          return (
            <button key={e.id} onClick={() => onSelect(e.id)}
              className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                <div>
                  <div className="font-medium text-slate-800">{e.ragione_sociale}</div>
                  <div className="text-xs text-slate-500">{e.referente && `${e.referente} · `}{contrattiAperti} contratti aperti</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SchedaAllievo({ data, reload, allievoId, currentUser, onBack }) {
  const allievo = data.allievi.find(a => a.id === allievoId);
  const contratti = data.contratti.filter(c => c.tipo_intestatario === 'allievo' && c.allievo_id === allievoId);
  const [confermaElimina, setConfermaElimina] = useState(null);

  if (!allievo) return null;

  const handleDeleteLezione = async (lezioneId) => {
    await supabase.from('lezioni').delete().eq('id', lezioneId);
    setConfermaElimina(null);
    await reload();
  };

  return (
    <div>
      <button onClick={onBack} className="text-indigo-600 text-sm mb-4 hover:text-indigo-800">← Torna agli allievi</button>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">{allievo.nome[0]}{allievo.cognome[0]}</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{allievo.nome} {allievo.cognome}</h2>
            <p className="text-sm text-slate-500">{allievo.email} · {allievo.telefono}</p>
            {allievo.note && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-2 inline-block">⚠ {allievo.note}</p>}
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-slate-800 mb-3">Contratti</h3>
      <div className="space-y-3">
        {contratti.length === 0 && <p className="text-sm text-slate-500">Nessun contratto.</p>}
        {contratti.map(c => {
          const servizio = data.servizi.find(s => s.id === c.servizio_id);
          const istruttoreT = data.istruttori.find(i => i.id === c.istruttore_titolare_id);
          const istruttoreS = data.istruttori.find(i => i.id === c.istruttore_sostituto_id);
          const lezioniContratto = data.lezioni.filter(l => l.contratto_id === c.id).sort((a, b) => b.data.localeCompare(a.data));
          const erogate = lezioniContratto.length;
          const residue = c.lezioni_totali - erogate;
          const pct = Math.min(100, (erogate / c.lezioni_totali) * 100);
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-800">{servizio?.nome}</h4>
                    <p className="text-xs text-slate-500">Istruttore: {istruttoreT?.nome} {istruttoreT?.cognome}{istruttoreS && ` · Sostituto: ${istruttoreS.nome} ${istruttoreS.cognome}`}</p>
                    <p className="text-xs text-slate-500">Iniziato il {formatDate(c.data_inizio)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.stato === 'aperto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{c.stato}</span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{erogate} di {c.lezioni_totali} lezioni</span>
                    <span className={`font-medium ${residue <= 0 ? 'text-red-600' : residue <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>{residue} residue</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <ListaLezioni lezioni={lezioniContratto} data={data} currentUser={currentUser} confermaElimina={confermaElimina} setConfermaElimina={setConfermaElimina} handleDelete={handleDeleteLezione} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchedaEnte({ data, reload, enteId, currentUser, onBack }) {
  const ente = data.enti.find(e => e.id === enteId);
  const contratti = data.contratti.filter(c => c.tipo_intestatario === 'ente' && c.ente_id === enteId);
  const [confermaElimina, setConfermaElimina] = useState(null);

  if (!ente) return null;

  const handleDeleteLezione = async (lezioneId) => {
    await supabase.from('lezioni').delete().eq('id', lezioneId);
    setConfermaElimina(null);
    await reload();
  };

  return (
    <div>
      <button onClick={onBack} className="text-indigo-600 text-sm mb-4 hover:text-indigo-800">← Torna agli enti</button>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-full flex items-center justify-center"><Building2 className="w-7 h-7" /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{ente.ragione_sociale}</h2>
            <p className="text-sm text-slate-500">{ente.referente && `${ente.referente} · `}{ente.email} · {ente.telefono}</p>
            {ente.note && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-2 inline-block">⚠ {ente.note}</p>}
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-slate-800 mb-3">Contratti</h3>
      <div className="space-y-3">
        {contratti.length === 0 && <p className="text-sm text-slate-500">Nessun contratto.</p>}
        {contratti.map(c => {
          const servizio = data.servizi.find(s => s.id === c.servizio_id);
          const istruttoreT = data.istruttori.find(i => i.id === c.istruttore_titolare_id);
          const istruttoreS = data.istruttori.find(i => i.id === c.istruttore_sostituto_id);
          const lezioniContratto = data.lezioni.filter(l => l.contratto_id === c.id).sort((a, b) => b.data.localeCompare(a.data));
          const erogate = lezioniContratto.length;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">{servizio?.nome}
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><InfinityIcon className="w-3 h-3" /> Illimitato</span>
                    </h4>
                    <p className="text-xs text-slate-500">Istruttore: {istruttoreT?.nome} {istruttoreT?.cognome}{istruttoreS && ` · Sostituto: ${istruttoreS.nome} ${istruttoreS.cognome}`}</p>
                    <p className="text-xs text-slate-500">Iniziato il {formatDate(c.data_inizio)}</p>
                    {c.note && <p className="text-xs text-slate-600 mt-1">📝 {c.note}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.stato === 'aperto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{c.stato}</span>
                </div>
                <div className="mt-3 bg-purple-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-purple-800">Lezioni erogate dal {formatDate(c.data_inizio)}</span>
                  <span className="text-2xl font-bold text-purple-900">{erogate}</span>
                </div>
              </div>
              <ListaLezioni lezioni={lezioniContratto} data={data} currentUser={currentUser} confermaElimina={confermaElimina} setConfermaElimina={setConfermaElimina} handleDelete={handleDeleteLezione} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListaLezioni({ lezioni, data, currentUser, confermaElimina, setConfermaElimina, handleDelete }) {
  if (lezioni.length === 0) return null;
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">DATE DELLE LEZIONI</p>
      <div className="space-y-1">
        {lezioni.map(l => {
          const istr = data.istruttori.find(i => i.id === l.istruttore_id);
          const canDelete = currentUser.role === 'admin' || l.created_by === currentUser.id;
          const isConfirming = confermaElimina === l.id;
          return (
            <div key={l.id} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-700">{formatDate(l.data)}</span>
                <span className="text-xs text-slate-500">· {istr?.nome} {istr?.cognome}</span>
                {l.note && <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{l.note}</span>}
              </div>
              {canDelete && (isConfirming ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(l.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Elimina</button>
                  <button onClick={() => setConfermaElimina(null)} className="text-xs bg-slate-200 px-2 py-0.5 rounded hover:bg-slate-300">Annulla</button>
                </div>
              ) : (
                <button onClick={() => setConfermaElimina(l.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportIstruttore({ data, currentUser }) {
  const isAdmin = currentUser.role === 'admin';
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [istruttoreSelId, setIstruttoreSelId] = useState(currentUser.istruttoreId || data.istruttori[0]?.id);

  const targetIstruttoreId = isAdmin ? istruttoreSelId : currentUser.istruttoreId;
  const targetIstruttore = data.istruttori.find(i => i.id === targetIstruttoreId);

  const lezioniMese = useMemo(() => {
    const mm = String(month).padStart(2, '0');
    const prefix = `${year}-${mm}`;
    return data.lezioni.filter(l => l.istruttore_id === targetIstruttoreId && l.data.startsWith(prefix));
  }, [data.lezioni, year, month, targetIstruttoreId]);

  const giorniMese = new Date(year, month, 0).getDate();
  const perGiorno = useMemo(() => {
    const mm = String(month).padStart(2, '0');
    const map = {};
    for (let d = 1; d <= giorniMese; d++) map[`${year}-${mm}-${String(d).padStart(2, '0')}`] = [];
    lezioniMese.forEach(l => { if (map[l.data]) map[l.data].push(l); });
    return map;
  }, [lezioniMese, year, month, giorniMese]);

  const meseLabel = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const meseNomeFile = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
  const lezioniAllievo = lezioniMese.filter(l => data.contratti.find(c => c.id === l.contratto_id)?.tipo_intestatario === 'allievo').length;
  const lezioniEnte = lezioniMese.length - lezioniAllievo;

  const exportCSV = () => {
    const istrName = targetIstruttore ? `${targetIstruttore.nome} ${targetIstruttore.cognome}` : '';
    const sep = ';';
    const rows = [];
    rows.push(['Istruttore', istrName].join(sep));
    rows.push(['Mese', meseLabel].join(sep));
    rows.push(['Totale lezioni', lezioniMese.length].join(sep));
    rows.push(['Lezioni Allievi', lezioniAllievo].join(sep));
    rows.push(['Lezioni Enti', lezioniEnte].join(sep));
    rows.push(['Documento pseudonimizzato (GDPR) - solo codici contratto'].join(sep));
    rows.push('');
    rows.push(['Data', 'Giorno', 'Numero lezioni', 'Codice contratto', 'Tipo', 'Codice servizio', 'Note'].join(sep));
    Object.entries(perGiorno).forEach(([dataIso, lezioni]) => {
      const giorno = new Date(dataIso);
      const dataIt = giorno.toLocaleDateString('it-IT');
      const giornoSet = giorno.toLocaleDateString('it-IT', { weekday: 'long' });
      if (lezioni.length === 0) rows.push([dataIt, giornoSet, 0, '', '', '', ''].join(sep));
      else lezioni.forEach((l, idx) => {
        const c = data.contratti.find(x => x.id === l.contratto_id);
        const s = data.servizi.find(x => x.id === c?.servizio_id);
        const tipo = c?.tipo_intestatario === 'ente' ? 'Ente' : 'Allievo';
        const noteEsc = (l.note || '').replace(/"/g, '""');
        rows.push([idx === 0 ? dataIt : '', idx === 0 ? giornoSet : '', idx === 0 ? lezioni.length : '', c?.codice || '', tipo, s?.codice || '', `"${noteEsc}"`].join(sep));
      });
    });
    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${(targetIstruttore?.cognome || 'istruttore')}_${meseNomeFile}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPrint = () => {
    const istrName = targetIstruttore ? `${targetIstruttore.nome} ${targetIstruttore.cognome}` : '';
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Abilita i popup per stampare il report.'); return; }
    const rowsHtml = Object.entries(perGiorno).map(([dataIso, lezioni]) => {
      const giorno = new Date(dataIso);
      const dataIt = giorno.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      const giornoSet = giorno.toLocaleDateString('it-IT', { weekday: 'short' });
      const isWeekend = giorno.getDay() === 0 || giorno.getDay() === 6;
      const dettaglio = lezioni.length === 0 ? '—' : lezioni.map(l => {
        const c = data.contratti.find(x => x.id === l.contratto_id);
        const s = data.servizi.find(x => x.id === c?.servizio_id);
        const tipo = c?.tipo_intestatario === 'ente' ? '[E]' : '[A]';
        return `${tipo} <strong>${c?.codice || '?'}</strong> <span style="color:#64748b">${s?.codice || ''}</span>${l.note ? ' — ' + l.note : ''}`;
      }).join('<br>');
      return `<tr class="${isWeekend ? 'weekend' : ''}"><td class="data">${dataIt} ${giornoSet}</td><td class="num">${lezioni.length || ''}</td><td>${dettaglio}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Report ${istrName} - ${meseLabel}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:24px;color:#1e293b}h1{font-size:20px;margin:0 0 4px}.sub{color:#64748b;font-size:13px;margin-bottom:16px}.meta{display:flex;gap:24px;padding:12px;background:#f1f5f9;border-radius:8px;margin-bottom:16px;font-size:13px}.meta strong{display:block;font-size:18px;color:#1e293b}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f8fafc;font-weight:600}td.data{white-space:nowrap;width:120px}td.num{text-align:center;width:50px;font-weight:600}tr.weekend{background:#f8fafc}.firma{margin-top:32px;display:flex;justify-content:space-between;font-size:13px}.firma div{width:45%}.firma .line{border-top:1px solid #94a3b8;margin-top:32px;padding-top:4px;color:#64748b;font-size:11px}.legend{font-size:11px;color:#64748b;margin-top:8px}@media print{body{margin:12mm}.noprint{display:none}}.actions{margin-bottom:16px}.actions button{padding:6px 12px;margin-right:8px;cursor:pointer}</style></head>
<body><div class="actions noprint"><button onclick="window.print()">🖨 Stampa / Salva PDF</button><button onclick="window.close()">Chiudi</button></div>
<h1>Report mensile lezioni erogate</h1><div class="sub">ASD — Generato il ${new Date().toLocaleDateString('it-IT')}</div>
<div class="meta"><div><span style="color:#64748b">Istruttore</span><strong>${istrName}</strong></div><div><span style="color:#64748b">Periodo</span><strong>${meseLabel}</strong></div><div><span style="color:#64748b">Totale lezioni</span><strong>${lezioniMese.length}</strong></div><div><span style="color:#64748b">Allievi / Enti</span><strong>${lezioniAllievo} / ${lezioniEnte}</strong></div></div>
<table><thead><tr><th>Giorno</th><th>Lezioni</th><th>Dettaglio (codici)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<div class="legend">[A] = lezione ad Allievo · [E] = lezione ad Ente · <strong>CT-AAAA-NNNN</strong> = codice contratto · <strong>XXX</strong> = codice servizio<br><em>Documento pseudonimizzato ai sensi del GDPR (Reg. UE 2016/679 art. 4 n. 5). I codici contratto sono riconducibili agli intestatari solo tramite la chiave di mappatura conservata dal Titolare del trattamento.</em></div>
<div class="firma"><div><div class="line">Firma istruttore</div></div><div><div class="line">Firma responsabile</div></div></div></body></html>`;
    w.document.write(html); w.document.close();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Report mensile istruttore</h2>
      <p className="text-slate-500 mb-4">Lezioni erogate giorno per giorno</p>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        {isAdmin && (
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Istruttore</label>
            <select value={istruttoreSelId} onChange={(e) => setIstruttoreSelId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg">
              {data.istruttori.map(i => <option key={i.id} value={i.id}>{i.nome} {i.cognome}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Mese</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString('it-IT', { month: 'long' })}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Anno</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2 items-end">
          <button onClick={exportCSV} disabled={lezioniMese.length === 0}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportPrint} disabled={lezioniMese.length === 0}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Stampa/PDF
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-4 items-center">
        <div className="bg-indigo-50 px-4 py-2 rounded-lg">
          <div className="text-xs text-indigo-700">Totale {meseLabel}</div>
          <div className="text-2xl font-bold text-indigo-900">{lezioniMese.length}</div>
        </div>
        <div className="bg-slate-50 px-3 py-2 rounded-lg text-xs">
          <div className="flex items-center gap-1 text-indigo-700"><User className="w-3 h-3" /> Allievi: <strong>{lezioniAllievo}</strong></div>
          <div className="flex items-center gap-1 text-purple-700 mt-1"><Building2 className="w-3 h-3" /> Enti: <strong>{lezioniEnte}</strong></div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr><th className="text-left px-4 py-2 font-semibold text-slate-700">Giorno</th><th className="text-left px-4 py-2 font-semibold text-slate-700">Lezioni</th><th className="text-left px-4 py-2 font-semibold text-slate-700">Dettaglio</th></tr>
          </thead>
          <tbody>
            {Object.entries(perGiorno).map(([data_, lezioni]) => {
              const giorno = new Date(data_);
              const isWeekend = giorno.getDay() === 0 || giorno.getDay() === 6;
              return (
                <tr key={data_} className={`border-t border-slate-100 ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-4 py-2"><div className="font-medium text-slate-800">{giorno.toLocaleDateString('it-IT', { day: '2-digit', weekday: 'short' })}</div></td>
                  <td className="px-4 py-2">{lezioni.length > 0 ? <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 bg-indigo-100 text-indigo-700 rounded-full font-semibold">{lezioni.length}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {lezioni.map(l => {
                      const c = data.contratti.find(x => x.id === l.contratto_id);
                      const s = data.servizi.find(x => x.id === c?.servizio_id);
                      const isEnte = c?.tipo_intestatario === 'ente';
                      return (
                        <span key={l.id} className={`inline-flex items-center gap-1 mr-2 mb-1 text-xs px-2 py-0.5 rounded ${isEnte ? 'bg-purple-100 text-purple-700' : 'bg-slate-100'}`}>
                          {isEnte ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {intestatarioLabel(data, c)} <span className="opacity-70">({s?.nome})</span>
                        </span>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminPanel({ data, reload }) {
  const [tab, setTab] = useState('contratti');
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Gestione</h2>
      <p className="text-slate-500 mb-4">Anagrafiche e contratti (solo admin)</p>
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {['contratti', 'allievi', 'enti', 'servizi', 'istruttori'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'contratti' && <GestioneContratti data={data} reload={reload} />}
      {tab === 'allievi' && <GestioneAnagrafica data={data} reload={reload} tipo="allievi" />}
      {tab === 'enti' && <GestioneAnagrafica data={data} reload={reload} tipo="enti" />}
      {tab === 'servizi' && <GestioneAnagrafica data={data} reload={reload} tipo="servizi" />}
      {tab === 'istruttori' && <GestioneAnagrafica data={data} reload={reload} tipo="istruttori" />}
    </div>
  );
}

function GestioneContratti({ data, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    tipo_intestatario: 'allievo', allievo_id: '', ente_id: '', servizio_id: '',
    istruttore_titolare_id: '', istruttore_sostituto_id: '',
    lezioni_totali: 10, data_inizio: todayISO(), note: '',
  });

  const handleAdd = async () => {
    setSaving(true); setError('');
    const payload = {
      tipo_intestatario: form.tipo_intestatario,
      allievo_id: form.tipo_intestatario === 'allievo' ? form.allievo_id : null,
      ente_id: form.tipo_intestatario === 'ente' ? form.ente_id : null,
      servizio_id: form.servizio_id,
      istruttore_titolare_id: form.istruttore_titolare_id,
      istruttore_sostituto_id: form.istruttore_sostituto_id || null,
      lezioni_totali: form.tipo_intestatario === 'ente' ? null : Number(form.lezioni_totali),
      data_inizio: form.data_inizio,
      stato: 'aperto',
      note: form.note || null,
    };
    const { error } = await supabase.from('contratti').insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setShowForm(false);
    setForm({ tipo_intestatario: 'allievo', allievo_id: '', ente_id: '', servizio_id: '', istruttore_titolare_id: '', istruttore_sostituto_id: '', lezioni_totali: 10, data_inizio: todayISO(), note: '' });
    await reload();
  };

  const toggleStato = async (c) => {
    await supabase.from('contratti').update({ stato: c.stato === 'aperto' ? 'chiuso' : 'aperto' }).eq('id', c.id);
    await reload();
  };

  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} className="mb-3 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> Nuovo contratto
      </button>
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setForm({...form, tipo_intestatario: 'allievo', ente_id: ''})} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${form.tipo_intestatario === 'allievo' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}>
              <User className="w-4 h-4 inline mr-1" /> Allievo
            </button>
            <button onClick={() => setForm({...form, tipo_intestatario: 'ente', allievo_id: ''})} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${form.tipo_intestatario === 'ente' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200'}`}>
              <Building2 className="w-4 h-4 inline mr-1" /> Ente
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.tipo_intestatario === 'allievo' ? (
              <select value={form.allievo_id} onChange={(e) => setForm({...form, allievo_id: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">Allievo...</option>
                {data.allievi.map(a => <option key={a.id} value={a.id}>{a.nome} {a.cognome}</option>)}
              </select>
            ) : (
              <select value={form.ente_id} onChange={(e) => setForm({...form, ente_id: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">Ente...</option>
                {data.enti.map(e => <option key={e.id} value={e.id}>{e.ragione_sociale}</option>)}
              </select>
            )}
            <select value={form.servizio_id} onChange={(e) => setForm({...form, servizio_id: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg">
              <option value="">Servizio...</option>
              {data.servizi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <select value={form.istruttore_titolare_id} onChange={(e) => setForm({...form, istruttore_titolare_id: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg">
              <option value="">Istruttore titolare...</option>
              {data.istruttori.map(i => <option key={i.id} value={i.id}>{i.nome} {i.cognome}</option>)}
            </select>
            <select value={form.istruttore_sostituto_id} onChange={(e) => setForm({...form, istruttore_sostituto_id: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg">
              <option value="">Sostituto (opzionale)...</option>
              {data.istruttori.map(i => <option key={i.id} value={i.id}>{i.nome} {i.cognome}</option>)}
            </select>
            {form.tipo_intestatario === 'allievo' ? (
              <input type="number" value={form.lezioni_totali} onChange={(e) => setForm({...form, lezioni_totali: e.target.value})} placeholder="N. lezioni" className="px-3 py-2 border border-slate-300 rounded-lg" />
            ) : (
              <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 flex items-center gap-1">
                <InfinityIcon className="w-4 h-4" /> Lezioni illimitate
              </div>
            )}
            <input type="date" value={form.data_inizio} onChange={(e) => setForm({...form, data_inizio: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input type="text" value={form.note} onChange={(e) => setForm({...form, note: e.target.value})} placeholder="Note" className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <button onClick={handleAdd} disabled={saving} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Salvo...' : 'Crea contratto'}
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold text-slate-700">Codice</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Tipo</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Intestatario</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Servizio</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Istruttore</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Lezioni</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Stato</th>
            </tr>
          </thead>
          <tbody>
            {data.contratti.map(c => {
              const s = data.servizi.find(x => x.id === c.servizio_id);
              const i = data.istruttori.find(x => x.id === c.istruttore_titolare_id);
              const erogate = data.lezioni.filter(l => l.contratto_id === c.id).length;
              const isEnte = c.tipo_intestatario === 'ente';
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{c.codice}</td>
                  <td className="px-3 py-2">
                    {isEnte ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Ente</span> : <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Allievo</span>}
                  </td>
                  <td className="px-3 py-2">{intestatarioLabel(data, c)}</td>
                  <td className="px-3 py-2">{s?.nome} <span className="text-xs text-slate-400 font-mono">({s?.codice})</span></td>
                  <td className="px-3 py-2">{i?.nome} {i?.cognome}</td>
                  <td className="px-3 py-2">{isEnte ? <span className="flex items-center gap-1 text-purple-700"><InfinityIcon className="w-3 h-3" /> {erogate} erog.</span> : `${erogate}/${c.lezioni_totali}`}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleStato(c)} className={`text-xs px-2 py-1 rounded-full font-medium ${c.stato === 'aperto' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{c.stato}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GestioneAnagrafica({ data, reload, tipo }) {
  const config = {
    allievi: { titolo: 'allievi', tabella: 'allievi', campi: ['nome', 'cognome', 'email', 'telefono', 'note'], displayLabel: a => `${a.nome} ${a.cognome}` },
    enti: { titolo: 'enti', tabella: 'enti', campi: ['ragione_sociale', 'referente', 'email', 'telefono', 'note'], displayLabel: e => e.ragione_sociale },
    servizi: { titolo: 'servizi', tabella: 'servizi', campi: ['nome', 'descrizione'], displayLabel: s => s.nome, extra: { attivo: true } },
    istruttori: { titolo: 'istruttori', tabella: 'istruttori', campi: ['nome', 'cognome'], displayLabel: i => `${i.nome} ${i.cognome}`, extra: { attivo: true } },
  }[tipo];

  const items = data[tipo] || [];
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    setSaving(true); setError('');
    const payload = { ...form, ...(config.extra || {}) };
    config.campi.forEach(c => { if (!payload[c]) payload[c] = null; });
    const { error } = await supabase.from(config.tabella).insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setForm({});
    await reload();
  };

  const placeholders = { nome: 'Nome', cognome: 'Cognome', email: 'Email', telefono: 'Telefono', note: 'Note', ragione_sociale: 'Ragione sociale', referente: 'Referente', descrizione: 'Descrizione' };

  return (
    <div>
      {(tipo === 'allievi' || tipo === 'enti') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-800">
          🔒 <strong>Mappatura GDPR</strong>: ogni record ha un codice anonimo generato automaticamente. Nei report esportati si usano solo i codici contratto.
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {config.campi.map(c => (
          <input key={c} value={form[c] || ''} onChange={(e) => setForm({...form, [c]: e.target.value})}
            placeholder={placeholders[c] || c} className="px-3 py-2 border border-slate-300 rounded-lg" />
        ))}
        {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <button onClick={handleAdd} disabled={saving} className="sm:col-span-2 bg-emerald-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
          {saving ? 'Salvo...' : `Aggiungi ${config.titolo.slice(0, -1)}`}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.id} className="p-3">
            <div className="font-medium text-slate-800 flex items-center gap-2">
              {item.codice && <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.codice}</span>}
              {tipo === 'enti' && <Building2 className="w-4 h-4 text-purple-600" />}
              {config.displayLabel(item)}
            </div>
            <div className="text-xs text-slate-500">
              {item.email && `${item.email} · `}{item.telefono}{item.descrizione}{item.referente && `${item.referente}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

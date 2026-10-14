import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Task = { id: number; title: string; done: number };

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Não foi possível acessar a API.');
  }
  return response.status === 204 ? null : response.json();
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  async function load() { setTasks(await api('/tasks')); }
  useEffect(() => {
    load().catch(e => setError(e.message)).finally(() => setBusy(false));
  }, []);
  async function change(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha na operação.'); }
    finally { setBusy(false); }
  }
  function add(event: FormEvent) {
    event.preventDefault();
    void change(async () => {
      await api('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      setTitle('');
    });
  }
  return <main>
    <span className="label">LABORATÓRIO DE INFRAESTRUTURA</span>
    <h1>InfraLab</h1>
    <p>Uma tarefa de cada vez.</p>
    <form onSubmit={add}>
      <label htmlFor="title">Nova tarefa</label>
      <div className="row"><input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required placeholder="O que vamos aprender?" />
      <button disabled={busy || !title.trim()}>Adicionar</button></div>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {busy && <p role="status">Carregando…</p>}
    {!busy && !error && tasks.length === 0 && <p>Nenhuma tarefa ainda. Adicione a primeira.</p>}
    <ul>{tasks.map(task => <li key={task.id}>
      <label className="task"><input type="checkbox" checked={Boolean(task.done)} disabled={busy}
        onChange={() => void change(() => api(`/tasks/${task.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !task.done })
        }))} /><span className={task.done ? 'done' : ''}>{task.title}</span></label>
      <button className="remove" disabled={busy} aria-label={`Excluir ${task.title}`}
        onClick={() => void change(() => api(`/tasks/${task.id}`, { method: 'DELETE' }))}>Excluir</button>
    </li>)}</ul>
    <footer>React · Node.js · SQLite · Docker</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);

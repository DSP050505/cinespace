import { useState } from 'react';

function MovieSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  const search = async () => {
    if (!query) return;
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (!apiKey) {
      alert("TMDB API Key missing in .env");
      return;
    }
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results || []);
  };

  return (
    <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
      <h3>Search TMDB</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          className="input" 
          placeholder="Search movie..." 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className="btn" onClick={search}>Search</button>
      </div>
      
      <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginTop: '10px' }}>
        {results.map(m => (
          <div key={m.id} style={{ minWidth: '100px', cursor: 'pointer' }} onClick={() => onSelect(m)}>
            {m.poster_path ? (
              <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} style={{ width: '100px', height: '150px', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100px', height: '150px', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Image</div>
            )}
            <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MovieSearch;

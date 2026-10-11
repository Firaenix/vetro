#!/usr/bin/env python3
import json,pathlib,statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'diagnostics';data={p:json.loads((D/f'benchmark-{p}-20261011.json').read_text()) for p in ['A','B']}
for d in data.values():
 if not d['completed']:raise SystemExit('Fase incompleta')
assert data['A']['planHash']==data['B']['planHash'];assert data['A']['bootId']!=data['B']['bootId']
fig,axes=plt.subplots(3,1,figsize=(11,8),sharex=True);colors={'A':'#929a9f','B':'#23745c'};summary={}
for phase,d in data.items():
 samples=[x for x in d['samples'] if 'monitor'in x];t=[x['elapsed'] for x in samples];m=[x['monitor'] for x in samples];cpu=[x['cpu']['percent'] for x in m];ram=[x['memory']['availableBytes']/1048576 for x in m];swap=[x['memory']['swapFreeBytes']/1048576 for x in m]
 label='A · cinque app riabilitate' if phase=='A' else 'B · debloat originale'
 axes[0].plot(t,cpu,color=colors[phase],label=label);axes[1].plot(t,ram,color=colors[phase]);axes[2].plot(t,swap,color=colors[phase]);summary[phase]={'samples':len(samples),'durationSeconds':d['durationSeconds'],'initialRamMiB':d['initial']['memory']['availableBytes']/1048576,'meanCpuPercent':statistics.mean(x for x in cpu if x is not None),'medianRamMiB':statistics.median(ram),'minRamMiB':min(ram),'endRamMiB':ram[-1],'endSwapFreeMiB':swap[-1],'medianKeyAckMs':statistics.median(x['ackSeconds']*1000 for x in d['actions'] if x['path']=='/control')}
 for index,app in enumerate(d['plan']['apps']):
  start=next(x['elapsed'] for x in d['actions'] if x['body'].get('appId')==app);end=next((x['elapsed'] for x in d['actions'] if x['path']=='/apps/launch' and x['elapsed']>start),d['durationSeconds']);stage=[x['monitor']for x in samples if start<=x['elapsed']<end];summary[phase][app]={'meanCpuPercent':statistics.mean(x['cpu']['percent']for x in stage if x['cpu']['percent']is not None),'medianRamMiB':statistics.median(x['memory']['availableBytes']/1048576 for x in stage)}
for ax,label in zip(axes,['CPU totale (%)','RAM disponibile (MiB)','Swap libera (MiB)']):
 ax.set_ylabel(label);ax.grid(axis='y',alpha=.2);ax.spines[['top','right']].set_visible(False)
 for x in [30,55,80,105,131,156]:ax.axvline(x,color='#dddddd',linewidth=.8)
axes[0].legend(frameon=False,loc='upper left');axes[2].set_xlabel('Secondi dall’inizio della sequenza');axes[0].set_title('Vetro · primo confronto A/B dopo spegnimento completo',loc='left',pad=18)
for x,name in [(30,'YouTube'),(55,'Stremio'),(80,'Disney+'),(105,'Prime'),(131,'Netflix'),(156,'Scroll')]:axes[0].text(x+1,1.01,name,transform=axes[0].get_xaxis_transform(),fontsize=8)
fig.text(.09,.015,'Una coppia esplorativa; cache/rete restano variabili. FPS e tempi di caricamento visivo non misurati.',fontsize=9,color='#737b84');fig.tight_layout(rect=(0,.04,1,1));fig.savefig(D/'benchmark-AB-20261011.png',dpi=160);fig.savefig(D/'benchmark-AB-20261011.svg');(D/'benchmark-summary-20261011.json').write_text(json.dumps(summary,indent=2))
report='''# Primo confronto A/B — Q80A, 2026-10-11

Entrambe le sequenze sono completate e confermate visivamente dall’utente. Cinque app e dodici tasti; nessun errore nei campioni. Due boot diversi, uptime iniziale allineato entro 0,28 s. Versione Vetro invariata durante le fasi; nessun cambio DNS o HbbTV. A riabilita i cinque app_disable iniziali; B ripristina esattamente quei flag, senza cambiare onboot/autorestart. Non equivale a un TV ripristinato alle impostazioni di fabbrica.

| Misura | A | B |
|---|---:|---:|
'''
for title,key,unit in [('RAM disponibile iniziale','initialRamMiB',' MiB'),('RAM disponibile mediana','medianRamMiB',' MiB'),('RAM disponibile minima','minRamMiB',' MiB'),('RAM disponibile finale','endRamMiB',' MiB'),('CPU media complessiva','meanCpuPercent','%'),('Swap libera finale','endSwapFreeMiB',' MiB'),('Risposta mediana al comando tasto','medianKeyAckMs',' ms')]:report+=f'| {title} | {summary["A"][key]:.1f}{unit} | {summary["B"][key]:.1f}{unit} |\n'
report+='''
![Grafico confronto](../diagnostics/benchmark-AB-20261011.png)

B lascia circa 43 MiB in più di memoria disponibile alla fine e ha CPU media inferiore di circa 2,5 punti percentuali in questa coppia. La differenza di RAM mediana è maggiore, ma il punto di partenza e le fasi intermedie mostrano variabilità. B partiva già con più RAM disponibile ma anche più swap occupata; la swap libera finale è inferiore in B. Non tutti gli indicatori migliorano e il diverso equilibrio fra RAM e swap non dimostra una riduzione equivalente del carico totale di memoria.

Durante A è stato osservato solo ACR fra i cinque target (massimo RSS ~17,5 MiB, attività CPU minima); gli altri quattro non erano presenti nei campioni. In B nessuno dei cinque è stato osservato. Potrebbero avere attività in avvio, prima della finestra campionata. Il test dimostra la persistenza dei flag globali e l’assenza di ACR in B, ma **non attribuisce causalmente tutte le differenze ai cinque target** e non dimostra un aumento della fluidità. Servono altre coppie, preferibilmente ABBA, e una misura visiva dei tempi/frame.

I tempi tasto sono ack HTTP/native injection, non ritardo input-to-photon. I tempi di apertura sono ack del launcher; alcuni processi possono essere precaricati. Non abbiamo misurato il tempo alla schermata utilizzabile. Il getter compositor restituisce un’ABI `a(usiud)` non interpretata: conservati record originali, nessun conteggio “sotto 60 FPS”. Gli intervalli effettivi fra i tasti includono il tempo di ack e sono registrati: sequenza e pausa uguali, tempi reali non esattamente identici.

## DNS e stato finale

Dopo B, il filtro locale è attivo. `config.samsungads.com` risolve a 0.0.0.0 e :: tramite getent nei namespace di Netflix, YouTube e Vetro. È una prova del resolver in quei namespace, non della totalità delle richieste HTTP interne alle app. DNS custom/fallback invariati (custom resolver and fallback); HbbTV resta al valore 20. Conservati output in benchmark-postflight e dns-namespace. Nessuna nuova blocklist applicata.

I cinque flag originari sono ripristinati e verificati dopo il boot B. Nessuna disinstallazione o modifica dei flag di avvio. I dati grezzi A/B, gli output pkgcmd e la fotografia iniziale sono in diagnostics; piano e script sono in scripts/benchmark-tv.py e docs/BENCHMARK.md.
'''
(ROOT/'docs/BENCHMARK-RESULTS-20261011.md').write_text(report)
print(json.dumps({p:{k:v for k,v in s.items() if not isinstance(v,dict)}for p,s in summary.items()},indent=2))

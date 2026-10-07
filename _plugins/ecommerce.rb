# frozen_string_literal: true

# E-COMMERCE (interruttore + pagine prodotto). Doc: CLAUDE.md > punto "E-COMMERCE".
# PUNTI CRITICI
# 1) Interruttore = chiave `ecommerce: true|false` in _config.yml (admin > Impostazioni > "Abilita e-commerce").
#    Attivo SOLO se vale true: chiave assente = spento.
# 2) Spento = spariscono dalla build (quindi dal menu, dalla sitemap e dagli URL) tutte le pagine con `ecommerce: true`
#    nel front matter (/negozio/, /grazie/), le pagine prodotto generate qui e i file statici del negozio (FILE_STATICI). Il codice resta nel repo.
# 3) Le pagine prodotto /negozio/<id>/ nascono da _data/catalogo.json (stessa fonte del Worker e dell'admin).
#    Prodotti con `visibile: false` o id non valido (solo a-z 0-9 e -) vengono saltati.
# 4) Nuove pagine del negozio: mettere `ecommerce: true` nel front matter, altrimenti restano online a e-commerce spento.
require 'cgi'

module BoxEcommerce
  FILE_STATICI = %w[assets/js/carrello.js assets/css/negozio.css].freeze

  def self.attivo?(site)
    site.config['ecommerce'] == true
  end

  def self.periodo(prodotto)
    return '' unless prodotto['tipo'] == 'abbonamento'

    ogni = (prodotto['ogni'] || 1).to_i
    nomi = { 'week' => %w[settimana settimane], 'year' => %w[anno anni] }.fetch(prodotto['intervallo'], %w[mese mesi])
    ogni > 1 ? "ogni #{ogni} #{nomi[1]}" : "/ #{nomi[0]}"
  end

  class PaginaProdotto < Jekyll::PageWithoutAFile
    def initialize(site, prodotto, categoria)
      super(site, site.source, File.join('negozio', prodotto['id']), 'index.html')
      e = ->(v) { CGI.escapeHTML(v.to_s) }
      base = site.baseurl.to_s
      worker = ((site.data['negozio'] || {})['worker_url']).to_s
      self.data = {
        'layout' => 'page',
        'title' => prodotto['nome'],
        'description' => prodotto['descrizione'].to_s,
        'ecommerce' => true,
        'nav' => false
      }
      etichetta = categoria ? "#{categoria['icona']} #{categoria['nome']}" : ''
      self.content = <<~HTML
        <div id="negozio" data-worker="#{e.(worker)}">
        <div class="nz-riga nz-box nz-scheda" data-id="#{e.(prodotto['id'])}" data-nome="#{e.(prodotto['nome'])}" data-prezzo="#{prodotto['prezzo_centesimi'].to_i}" data-tipo="#{e.(prodotto['tipo'])}" data-periodo="#{e.(BoxEcommerce.periodo(prodotto))}">
        <div class="nz-icona">#{e.(prodotto['icona'])}</div>
        <div class="nz-testo">
        <p class="nz-cat">#{e.(etichetta)}</p>
        <p>#{e.(prodotto['descrizione'])}</p>
        <p class="nz-prezzo fw-bold"></p>
        </div>
        <div class="nz-azioni">
        <label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
        <button type="button" class="btn btn-primary nz-add">Aggiungi al carrello</button>
        <span class="nz-ok" aria-live="polite"></span>
        </div>
        </div>
        <p><a href="#{e.(base)}/negozio/">&larr; Torna al negozio</a> &middot; <a href="#{e.(base)}/negozio/#carrello">Vai al carrello</a></p>
        </div>
      HTML
    end
  end

  class Generatore < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      return unless BoxEcommerce.attivo?(site)

      catalogo = site.data['catalogo'] || {}
      cats = (catalogo['categorie'] || []).each_with_object({}) { |c, h| h[c['id']] = c }
      (catalogo['box'] || []).each do |p|
        next if p['visibile'] == false
        next unless p['id'].to_s.match?(/\A[a-z0-9-]+\z/)

        site.pages << PaginaProdotto.new(site, p, cats[p['categoria']])
      end
    end
  end
end

# E-commerce spento: via dalla build le pagine marcate `ecommerce: true` (negozio, grazie) e i file statici del negozio (carrello.js, negozio.css).
# Spariscono anche dal menu, dalla sitemap e dagli URL. Nuovi file statici del negozio: aggiungili a FILE_STATICI.
Jekyll::Hooks.register :site, :post_read do |site|
  next if BoxEcommerce.attivo?(site)

  site.pages.reject! { |p| p.data['ecommerce'] }
  site.static_files.reject! { |f| BoxEcommerce::FILE_STATICI.include?(f.relative_path.sub(%r{\A/}, '')) }
end

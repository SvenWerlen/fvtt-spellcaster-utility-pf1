/************************************************
 * Spellcaster utility for casting prepared spells
 ************************************************/

class SCUCastSpells extends FormApplication {
  
  constructor(object, options) {
    super(object, options);
    
    console.log("Spellcaster Utility | Options", options)
    if(options && options.spellbook) {
      this.spellbook = options.spellbook
    } else {
      this.spellbook = "primary"
    }
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dialog", "scu", "cast", "pf1", "sheet", "actor", "character"],
      title: game.i18n.localize("scu.castTitle"),
      template: "modules/spellcaster-utility-pf1/templates/cast-spells.html",
      //width: 650,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    let data = {}

    // identify actor to render
    const tokens = canvas.tokens.controlled;
    let actors = tokens.map(o => o.actor);
    if (!actors.length) actors = game.actors.entities.filter(o => o.isPC && o.hasPerm(game.user, "OWNER"));
    actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));
    if( actors.length == 0 ) { data.errorMsg = game.i18n.format("scu.errorNoActor"); return data }
    if( actors.length > 1 ) { data.errorMsg = game.i18n.format("scu.errorMultipleActors"); return data }
    //if( !actors[0].isPC ) { data.errorMsg = game.i18n.format("scu.errorInvalidActor", { 'actor' : actors[0].name }); return data }
    this.actor = actors[0]
    
    // prepare spells (copy from actor)
    const spellbook = this.actor.data.data.attributes.spells.spellbooks[this.spellbook]
    data.spontaneous = spellbook.spontaneous

    let spells = duplicate(this.actor.data.items.filter( i => i.type == "spell" && i.data.data.spellbook == this.spellbook ))
    spells.sort(function(a,b) { return a.name.localeCompare(b.name); })
    
    let count = 0
    let levels = {}
    spells.forEach( sp => {
      //console.log(sp)
      const lvl = sp.data.level
      if(data.spontaneous && !sp.data.preparation.spontaneousPrepared) {
         return
      }
      else if( !data.spontaneous && sp.data.preparation.preparedAmount <= 0 ) {
        return;
      }
      else if( data.spontaneous && spellbook.spells["spell" + lvl].value <= 0 ) {
        return;
      }
      
      if( ! levels[lvl] ) {
        levels[lvl] = { level: lvl, localize : "PF1.SpellLevel" + lvl, 'spells': []}
        levels[lvl]['max'] = spellbook.spells["spell" + lvl].max
        levels[lvl]['remaining'] = data.spontaneous ? spellbook.spells["spell" + lvl].value : null
      }
      let spell = duplicate(sp)
      spell.data.school = CONFIG.PF1.spellSchools[sp.data.school]
      levels[lvl]['spells'].push(spell)
      count += 1
    });
    levels = Object.values(levels).sort(function(a,b) { return a.level - b.level; })
    data.levels = levels
    
    if( count == 0 ) {
      data.errorMsg = game.i18n.format("scu.errorNoSpellToCast", {actor: this.actor.name, spellbook: this.spellbook}); return data
    }
    
    return data
  }

  activateListeners(html) {
    //super.activateListeners(html);
    html.find('.item .item-image').click(event => this._onItemRoll(event));
    html.find(".item .item-name h4").click((event) => this._onItemSummary(event));
    html.find(".item-controls a").click(event => this._onItemUse(event));    
    
    // restore scroll position
    if(this.scrollTop) {
      html.find('.scroll').scrollTop(this.scrollTop);
    }
  }
  
  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
      item = this.actor.getOwnedItem(li.attr("data-item-id")),
      chatData = item.getChatData({ secrets: this.actor.owner });

    // Toggle summary
    if (li.hasClass("expanded")) {
      let summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      let div = $(`<div class="item-summary">${chatData.description.value}</div>`);
      let props = $(`<div class="item-properties"></div>`);
      chatData.properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }
  
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    if (item == null) return;
    return item.roll();
  }
  
  async _onItemUse(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    if (item == null) return;
    if( await item.use({ev: event}) ) {
      // keep track of current scroll position
      this.scrollTop = event.currentTarget.closest(".scroll").scrollTop;
      this.render(true)
    }
  }
  
}

/************************************************
 * Spellcaster utility for preparing the spells
 ************************************************/

class SCUPrepareSpells extends FormApplication {
  
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
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "prepare-spells",
      classes: ["dialog", "scu", "prepare", "pf1", "sheet", "actor", "character"],
      title: game.i18n.localize("scu.prepareTitle"),
      template: "modules/spellcaster-utility-pf1/templates/prepare-spells.html",
      //width: 650,
      height: "auto",
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    let data = {}

    // identify actor to render
    if( !this.actor ) {
      const tokens = canvas.tokens.controlled;
      let actors = tokens.map(o => o.actor);
      if (!actors.length) actors = game.actors.contents.filter(o => o.isOwner);
      if( actors.length == 0 ) { data.errorMsg = game.i18n.format("scu.errorNoActor"); return data }
      if( actors.length > 1 ) { data.errorMsg = game.i18n.format("scu.errorMultipleActors"); return data }
      this.actor = actors[0]
    }
    
    // prepare spells (copy from actor)
    const spellbook = this.actor.system.attributes.spells.spellbooks[this.spellbook]
    data.spontaneous = spellbook.spontaneous

    if( !this.spells ) {
      this.spells = foundry.utils.duplicate(this.actor.items.filter( i => i.type == "spell" && i.system.spellbook == this.spellbook ))
      this.spells.sort(function(a,b) { return a.name.localeCompare(b.name); })
    }
    
    if( this.spells.length == 0 ) {
      data.errorMsg = game.i18n.format("scu.errorNoSpell", {actor: this.actor.name, spellbook: this.spellbook}); return data
    }
    
    let levels = {}
    this.spells.forEach( sp => {
      const lvl = sp.system.level
      if( ! levels[lvl] ) {
        levels[lvl] = { level: lvl, localize : "PF1.SpellLevels." + lvl, prepared: 0, 'spells': []}
        levels[lvl]['max'] = spellbook.spells["spell" + lvl].max
      }
      let spell = foundry.utils.duplicate(sp)
      spell.system.school = CONFIG.PF1.spellSchools[sp.system.school]
      levels[lvl]['spells'].push(spell)
      spell.prepared = sp.system.preparation.value > 0 ? "prepared" : ""
      levels[lvl]['prepared'] += sp.system.preparation.value
    });
    levels = Object.values(levels).sort(function(a,b) { return a.level - b.level; })
    data.levels = levels
    
    return data
  }

  activateListeners(html) {
    //super.activateListeners(html);
    html.find(".item-controls a").click(this._onControl.bind(this));
    html.find('button[name="clear"]').click(this._onClear.bind(this))
    html.find('button[name="apply"]').click(this._onApply.bind(this))
    html.find(".item .item-name h4").click((event) => this._onItemSummary(event));
    html.find(".item .item-name h4").mousedown((event) => this._onTogglePrepare(event));
    html.find('.item .item-image').click(event => this._onItemRoll(event));
    
    // restore scroll position
    if(this.scrollTop) {
      html.find('.scroll').scrollTop(this.scrollTop);
    }
  }
  
  async _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item")
    let item = this.actor.items.get(li.attr("data-item-id"))
    
    // Toggle summary
    if (li.hasClass("expanded")) {
      let summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      let chatData = await item.getChatData({ chatcard: false })
      let div = $(`<div class="item-summary">${chatData.description}</div>`);
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
    const item = this.actor.items.get(itemId);

    if (item == null) return;
    return item.roll();
  }

  
  async _onTogglePrepare(event) {
    const spontaneous = this.actor.system.attributes.spells.spellbooks[this.spellbook].spontaneous
    if (spontaneous && event.which === 3) {
      const itemId = event.currentTarget.closest(".item").dataset.itemId;
      // retrieve spell
      let spell = this.spells.filter( i => i._id == itemId )
      if( spell.length == 0 ) return
      spell = spell[0]
      spell.system.preparation.value = spell.system.preparation.value > 0 ? 0 : 1
      this.render()
    }
  }

  async _onControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = a.closest(".item").dataset.itemId;

    // retrieve spell
    let spell = this.spells.filter( i => i._id == itemId )
    if( spell.length == 0 ) return
    spell = spell[0]
    
    // keep track of current scroll position
    this.scrollTop = a.closest(".scroll").scrollTop;
    
    // retrieve action (add/sub)
    let actionAdd = a.classList.contains("spell-uses-add")
    
    // increase / decrease
    const spontaneous = this.actor.system.attributes.spells.spellbooks[this.spellbook].spontaneous
    if(spontaneous) {
      spell.system.preparation.value = actionAdd ? 1 : 0
    }
    else {
      if(actionAdd) {
        spell.system.preparation.value++  
      } else if(spell.system.preparation.value > 0) {
        spell.system.preparation.value--
      }
    }
    this.render()
  }
  
  _onClear(event) {
    event.preventDefault();
    console.log("Spellcaster Utility | Clear preparation")
    if(!this.actor) { return }
    
    const spontaneous = this.actor.system.attributes.spells.spellbooks[this.spellbook].spontaneous
    this.spells.forEach( sp => {
      sp.system.preparation.value = 0
    });
    this.render()
  }
  
  
  _onApply(event) {
    event.preventDefault();
    console.log("Spellcaster Utility | Apply changes")
    if(!this.actor) { return }
    
    const spontaneous = this.actor.system.attributes.spells.spellbooks[this.spellbook].spontaneous
    
    let levels = {}
    let updates = []
    this.spells.forEach( sp => {
      const amount = sp.system.preparation.value

      // update count for that level
      if(levels[sp.system.level]) {
        levels[sp.system.level] += amount
      } else {
        levels[sp.system.level] = amount
      }

      updates.push( { 
        _id: sp._id, 
        system: {
          preparation: {
            value: amount,
            max: amount
          }
        }
      })
    });
    this.close()
    
    // update all spells
    this.actor.updateEmbeddedDocuments("Item", updates); // Updates one EmbeddedEntity
    
    // update character with count per level
    let update = { system: { attributes: { spells: { spellbooks: { } } } } }
    update.system.attributes.spells.spellbooks[this.spellbook] = { spells: {} }
    Object.keys(levels).forEach( lvl => {
      const key = "spell" + lvl
      const max = this.actor.system.attributes.spells.spellbooks[this.spellbook].spells[key].max
      if(!spontaneous) {
        update.system.attributes.spells.spellbooks[this.spellbook].spells[key] = { value: max - levels[lvl] }
      }
    });
    this.actor.update(update)
  }
  
}

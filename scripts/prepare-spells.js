/************************************************
 * Spellcaster utility for preparing the spells
 ************************************************/

class SCUPrepareSpells extends FormApplication {
  
  constructor(object, options) {
    super(object, options);
    
    this.spellbook = "primary"
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dialog", "scu", "prepare", "pf1", "sheet", "actor", "character"],
      title: game.i18n.localize("scu.prepareTitle"),
      template: "modules/spellcaster-utility-pf1/templates/prepare-spells.html",
      //width: 650,
      height: "auto",
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
      if (!actors.length) actors = game.actors.entities.filter(o => o.isPC && o.hasPerm(game.user, "OWNER"));
      actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));
      if( actors.length == 0 ) { data.errorMsg = game.i18n.format("scu.errorNoActor"); return data }
      if( actors.length > 1 ) { data.errorMsg = game.i18n.format("scu.errorMultipleActors"); return data }
      if( !actors[0].isPC ) { data.errorMsg = game.i18n.format("scu.errorInvalidActor", { 'actor' : actors[0].name }); return data }
      this.actor = actors[0]
      //console.log(this.actor)
    }
    
    // prepare spells (copy from actor)
    const spellbook = this.actor.data.data.attributes.spells.spellbooks[this.spellbook]
    data.spontaneous = spellbook.spontaneous

    if( !this.spells ) {
      this.spells = duplicate(this.actor.data.items.filter( i => i.type == "spell" ))
      this.spells.sort(function(a,b) { return a.name.localeCompare(b.name); })
    }
    
    let levels = {}
    this.spells.forEach( sp => {
      //console.log(sp)
      const lvl = sp.data.level
      if( ! levels[lvl] ) {
        levels[lvl] = { level: lvl, localize : "PF1.SpellLevel" + lvl, prepared: 0, 'spells': []}
        levels[lvl]['max'] = spellbook.spells["spell" + lvl].max
      }
      let spell = duplicate(sp)
      spell.data.school = CONFIG.PF1.spellSchools[sp.data.school]
      levels[lvl]['spells'].push(spell)
      if(data.spontaneous) {
        spell.prepared = sp.data.preparation.spontaneousPrepared ? "prepared" : ""
        levels[lvl]['prepared'] += spell.prepared ? 1 : 0
      }
      else {
        spell.prepared = sp.data.preparation.preparedAmount > 0 ? "prepared" : ""
        levels[lvl]['prepared'] += sp.data.preparation.preparedAmount
      }
    });
    levels = Object.values(levels).sort(function(a,b) { return a.level - b.level; })
    data.levels = levels
    
    return data
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".item-controls a").click(this._onControl.bind(this));
    html.find('button[name="clear"]').click(this._onClear.bind(this))
    html.find('button[name="apply"]').click(this._onApply.bind(this))
    
    // restore scroll position
    if(this.scrollTop) {
      html.find('.scroll').scrollTop(this.scrollTop);
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
    
    // increase / decrease
    const spontaneous = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spontaneous
    if(spontaneous) {
      spell.data.preparation.spontaneousPrepared = a.classList.contains("spell-uses-add")
    }
    else {
      if( a.classList.contains("spell-uses-add") ) {
        spell.data.preparation.preparedAmount += 1
      } else if( a.classList.contains("spell-uses-sub") ) {
        if( spell.data.preparation.preparedAmount == 0 ) return
        spell.data.preparation.preparedAmount -= 1
      }
    }
    this.render()
  }
  
  _onClear(event) {
    event.preventDefault();
    console.log("Spellcaster Utility | Clear preparation")
    if(!this.actor) { return }
    
    const spontaneous = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spontaneous
    this.spells.forEach( sp => {
      if(spontaneous) {
        sp.data.preparation.spontaneousPrepared = false
      } else {
        sp.data.preparation.preparedAmount = 0
      }
    });
    this.render()
  }
  
  
  _onApply(event) {
    event.preventDefault();
    console.log("Spellcaster Utility | Apply changes")
    if(!this.actor) { return }
    
    const spontaneous = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spontaneous
    
    let levels = {}
    let updates = []
    this.spells.forEach( sp => {
      const amount = spontaneous ? 0 : sp.data.preparation.preparedAmount

      // update count for that level
      if(levels[sp.data.level]) {
        levels[sp.data.level] += amount
      } else {
        levels[sp.data.level] = amount
      }
      
      // prepare update for spell
      if( spontaneous ) {
        updates.push( { 
          _id: sp._id, 
          data: { 
            preparation: { 
              spontaneousPrepared: sp.data.preparation.spontaneousPrepared 
            }
          }
        })
      } else {
        updates.push( { 
          _id: sp._id, 
          data: { 
            preparation: {
              preparedAmount: amount,
              maxAmount: amount
            }
          }
        })
      }
    });
    this.close()
    
    // update all spells
    this.actor.updateEmbeddedEntity("OwnedItem", updates); // Updates one EmbeddedEntity
    
    // update character with count per level
    let update = { data: { attributes: { spells: { spellbooks: { } } } } }
    update.data.attributes.spells.spellbooks[this.spellbook] = { spells: {} }
    Object.keys(levels).forEach( lvl => {
      const key = "spell" + lvl
      const max = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spells[key].max
      update.data.attributes.spells.spellbooks[this.spellbook].spells[key] = { value: max - levels[lvl] }
    });
    this.actor.update(update)
  }
  
}

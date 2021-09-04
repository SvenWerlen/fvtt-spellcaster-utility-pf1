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
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dialog", "scu", "prepare", "pf1", "sheet", "actor", "character"],
      title: game.i18n.localize("scu.prepareTitle"),
      template: "modules/spellcaster-utility-pf1/templates/prepare-spells.html",
      //width: 650,
      height: 600,
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
    const spellbook = this.actor.data.data.attributes.spells.spellbooks[this.spellbook]
    data.spontaneous = spellbook.spontaneous

    if( !this.spells ) {
      this.spells = duplicate(this.actor.data.items.filter( i => i.type == "spell" && i.data.data.spellbook == this.spellbook ))
      this.spells.sort(function(a,b) { return a.name.localeCompare(b.name); })
    }
    
    if( this.spells.length == 0 ) {
      data.errorMsg = game.i18n.format("scu.errorNoSpell", {actor: this.actor.name, spellbook: this.spellbook}); return data
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
    //super.activateListeners(html);
    html.find(".item-controls a").click(this._onControl.bind(this));
    html.find('button[name="clear"]').click(this._onClear.bind(this))
    html.find('button[name="apply"]').click(this._onApply.bind(this))
    html.find(".item .item-name h4").click((event) => this._onItemSummary(event));
    html.find('.item .item-image').click(event => this._onItemRoll(event));
    
    // restore scroll position
    if(this.scrollTop) {
      html.find('.scroll').scrollTop(this.scrollTop);
    }
  }
  
  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
      item = this.actor.items.get(li.attr("data-item-id")),
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
    const item = this.actor.items.get(itemId);

    if (item == null) return;
    return item.roll();
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
    const spontaneous = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spontaneous
    if(spontaneous) {
      spell.data.preparation.spontaneousPrepared = actionAdd
    }
    else {
      spell.data.preparation.preparedAmount += actionAdd ? 1 : -1
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
    this.actor.updateEmbeddedDocuments("Item", updates); // Updates one EmbeddedEntity
    
    // update character with count per level
    let update = { data: { attributes: { spells: { spellbooks: { } } } } }
    update.data.attributes.spells.spellbooks[this.spellbook] = { spells: {} }
    Object.keys(levels).forEach( lvl => {
      const key = "spell" + lvl
      const max = this.actor.data.data.attributes.spells.spellbooks[this.spellbook].spells[key].max
      if(!spontaneous) {
        update.data.attributes.spells.spellbooks[this.spellbook].spells[key] = { value: max - levels[lvl] }
      }
    });
    this.actor.update(update)
  }
  
}

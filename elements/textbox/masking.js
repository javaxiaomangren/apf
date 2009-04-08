/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 *
 */

// #ifdef __ENABLE_TEXTBOX_MASKING && (__JTEXTBOX || __INC_ALL)

/**
 * @constructor
 * @private
 */
jpf.textbox.masking = function(){
    /*
        Special Masking Values:
        - PASSWORD
        
        <j:Textbox name="custref" mask="CS20999999" maskmsg="" validation="/CS200[3-5]\d{4}/" invalidmsg="" bind="custref/text()" />
    */
    
    var _FALSE_ = 9128748732;

    var _REF = {
        "0" : "\\d",
        "1" : "[12]",
        "9" : "[\\d ]",
        "#" : "[\\d +-]",
        "L" : "[A-Za-z]",
        "?" : "[A-Za-z ]",
        "A" : "[A-Za-z0-9]",
        "a" : "[A-Za-z0-9 ]",
        "X" : "[0-9A-Fa-f]",
        "x" : "[0-9A-Fa-f ]",
        "&" : "[^\s]",
        "C" : "."
    };
    
    var lastPos = -1;
    var masking = false;
    var oExt    = this.oExt
    var initial, pos = [], myvalue, format, fcase, replaceChar;

    this.setPosition = function(setpos){
        setPosition(setpos || lastPos || 0);
    };

    this.$clear = function(){
        this.value = "";
        if (this.mask) 
            return this.setValue("");
    };
    
    this.$propHandlers["value"] = function(value){
        var data = "";
        if (this.includeNonTypedChars) {
            for (var i = 0; i < initial.length; i++) {
                if (initial.substr(i, 1) != value.substr(i, 1))
                    data += value.substr(i, 1);//initial.substr(i,1) == replaceChar
            }
        }
        
        this.$insertData(data || value);
    };
    
    /* ***********************
            Keyboard Support
    ************************/

    function isCharacter(e) {
        if (!e) return false;
        var key = e.which || e.keyCode;
        return !(e.ctrlKey || e.altKey || e.metaKey)
            && ((key >= 65 && key <= 90) // latin characters (A-Za-z)
            || (key >= 48 && key<= 57) // numbers (0-9)
            || (key == 32) // space
            || (key > 128));
    }

    
    //#ifdef __WITH_KEYBOARD
    this.addEventListener("keydown", function(e){
        var key      = e.which || e.keyCode;
        var ctrlKey  = e.ctrlKey;
        var shiftKey = e.shiftKey;

        switch (key) {
            case 39:	
                //RIGHT
                setPosition(lastPos + 1);
                break;
            case 37:
                //LEFT
                setPosition(lastPos - 1);
                break;
            case 35:
            case 34:
                setPosition(myvalue.length);
                break;
            case 33:
            case 36:
                setPosition(0);
                break;
            case 8:
                //BACKSPACE
                deletePosition(lastPos - 1);
                setPosition(lastPos - 1);
                break;
            case 46:
                //DEL
                deletePosition(lastPos);
                setPosition(lastPos);
                break;
            default:
                if (key == 67 && ctrlKey)
                    window.clipboardData.setData("Text", this.getValue());  
                /*
                else if ((key == 86 && ctrlKey) || (shiftKey && key == 45)) {
                    this.setValue(window.clipboardData.getData("Text"));
                    setPosition(lastPos);
                }
                */
                else
                    return;
            break;
        }
            
        return false;
    }, true);
    //#endif
    
    /* ***********************
            Init
    ************************/
    
    this.$initMasking = function(){
        ///this.keyHandler = this._keyHandler;
        this.$keyHandler = null; //temp solution
        masking = true;

        this.oInt.onkeypress = function(e){
            e = e || window.event;
            var chr = String.fromCharCode(e.which || e.keyCode);
            chr = (e.shiftKey ? chr.toUpperCase() : chr.toLowerCase());

            if (setCharacter(chr))
                setPosition(lastPos + 1);

            return false;
        };
        
        this.oInt.onmouseup = function(e){
            var pos = Math.min(calcPosFromCursor(), myvalue.length);
            setPosition(pos);
            if (isCharacter(e || window.event))
                return false;
        };
        
        this.oInt.onpaste = function(e){
            e = e || window.event;
            e.returnValue = false;
            this.host.setValue(window.clipboardData.getData("Text") || "");
            //setPosition(lastPos);
            setTimeout(function(){
                setPosition(lastPos);
            }, 1); //HACK good enough for now...
        };
        
        this.getValue = function(){
            if (this.includeNonTypedChars)
                return initial == this.oInt.value 
                    ? "" 
                    : this.oInt.value.replace(new RegExp(replaceChar, "g"), "");
            else
                return myvalue.join("");
        };
        
        this.setValue = function(value){
            if (this.includeNonTypedChars) {
                for (var data = "", i = 0; i < initial.length; i++) {
                    if (initial.substr(i,1) != value.substr(i,1))
                        data += value.substr(i, 1);//initial.substr(i,1) == replaceChar
                }
            }
            this.$insertData(data);
        };
    };
    
    this.setMask = function(m){
        if (!masking)
            this.$initMasking();
        
        m = m.split(";");
        replaceChar = m.pop();
        this.includeNonTypedChars = parseInt(m.pop()) !== 0;
        var mask = m.join(""); //why a join here???
        var validation = "",
            visual     = "",
            mode_case  = "-",
            strmode    = false,
            startRight = false,
            chr;
        pos = [], format = "", fcase = "";
        
        for (var looppos = -1, i = 0; i < mask.length; i++) {
            chr = mask.substr(i,1);
            
            if (!chr.match(/[\!\'\"\>\<\\]/))
                looppos++;
            else {
                if (chr == "!")
                    startRight = true;
                else if (chr == "<" || chr == ">")
                    mode_case = chr;
                else if (chr == "'" || chr == "\"")
                    strmode = !strmode;
                continue;
            }
            
            if (!strmode && _REF[chr]) {
                pos.push(looppos);
                visual     += replaceChar;
                format     += chr;
                fcase      += mode_case;
                validation += _REF[chr];
            }
            else
                visual += chr;
        }

        this.oInt.value = visual;
        initial         = visual;
        //pos = pos;
        myvalue = [];
        //format = format;
        //fcase = fcase;
        replaceChar = replaceChar;
        
        //setPosition(0);//startRight ? pos.length-1 : 0);
        
        //validation..
        //forgot \ escaping...
    };
    
    function checkChar(chr, p){
        var f = format.substr(p, 1);
        var c = fcase.substr(p, 1);
    
        if (chr.match(new RegExp(_REF[f])) == null)
            return _FALSE_;
        if (c == ">")
            return chr.toUpperCase();
        if (c == "<")
            return chr.toLowerCase();
        return chr;
    }

    function setPosition(p){
        if (p < 0)
            p = 0;

        if (jpf.hasMsRangeObject) {
            var range = oExt.createTextRange();
            range.expand("textedit");
            range.select();

            if (pos[p] == null) {
                range.collapse(false);
                range.select();
                lastPos = pos.length;
                return false;
            }

            range.collapse();
            range.moveStart("character", pos[p]);
            range.moveEnd("character", 1);
            range.select();
        }
        else {
            if (typeof pos[p] == "undefined") {
                oExt.selectionStart = oExt.selectionEnd = pos[pos.length - 1] + 1;
                lastPos = pos.length;
                return false;
            }
            oExt.selectionStart = pos[p];
            oExt.selectionEnd   = pos[p] + 1;
        }

        lastPos = p;
    }
    
    function setCharacter(chr){
        if (pos[lastPos] == null) return false;
        
        chr = checkChar(chr, lastPos);
        if (chr == _FALSE_) return false;

        if (jpf.hasMsRangeObject) {
            var range = oExt.createTextRange();
            range.expand("textedit");
            range.collapse();
            range.moveStart("character", pos[lastPos]);
            range.moveEnd("character", 1);
            range.text = chr;
            if (jpf.window.focussed == this)
                range.select();
        }
        else {
            var val    = oExt.value,
                start  = oExt.selectionStart,
                end    = oExt.selectionEnd;
            oExt.value = val.substr(0, start) + chr + val.substr(end);
            oExt.selectionStart = start;
            oExt.selectionEnd   = end;
        }
        
        myvalue[lastPos] = chr;
        
        return true;
    }
    
    function deletePosition(p){
        if(pos[p] == null) return false;
        
        if (jpf.hasMsRangeObject) {
            var range = oExt.createTextRange();
            range.expand("textedit");
            range.collapse();

            range.moveStart("character", pos[p]);
            range.moveEnd("character", 1);
            range.text = replaceChar;
            range.select();
        }
        else {
            var val    = oExt.value,
                start  = pos[p],
                end    = pos[p] + 1;
            oExt.value = val.substr(0, start) + replaceChar + val.substr(end);
            oExt.selectionStart = start;
            oExt.selectionEnd   = end;
        }
        
        //ipv lastPos
        myvalue[p] = " ";
    }
    
    this.$insertData = function(str){
        if (!jpf.hasMsRangeObject && oExt.selectionStart == oExt.selectionEnd) {
            setPosition(0); // is this always correct? practice will show...
        }

        if (str == this.getValue()) return;
        str = this.dispatchEvent("insert", { data : str }) || str;
        
        var i, j;
        if (!str) {
            if (!this.getValue()) return; //maybe not so good fix... might still flicker when content is cleared
            for (i = this.getValue().length - 1; i >= 0; i--)
                deletePosition(i);
            setPosition(0);	
            return;
        }
        
        for (i = 0, j = str.length; i < j; i++) {
            lastPos = i;
            setCharacter(str.substr(i, 1));
            if (!jpf.hasMsRangeObject)
                setPosition(i + 1);
        }
        if (str.length)
            lastPos++;
    };
    
    function calcPosFromCursor(){
        var range, lt = 0;

        if (!jpf.hasMsRangeObject) {
            lt = oExt.selectionStart;
        }
        else {
            range  = document.selection.createRange();
            var r2 = range.duplicate();
            r2.expand("textedit");
            r2.setEndPoint("EndToStart", range);
            lt = r2.text.length;
        }
    
        for (var i = 0; i < pos.length; i++) {
            if (pos[i] > lt)
                return (i == 0) ? 0 : i - 1;
        }

        return myvalue.length; // always return -a- value...
    }
};

// #endif

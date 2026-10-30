" Vim syntax file
" Language: Endo
"
" Based on the F# syntax file by Gregor Uhlenheuer <kongo2002@googlemail.com>.

if version < 600
    syntax clear
elseif exists('b:current_syntax')
    finish
endif

" Endo is case sensitive.
syn case match

" reset 'iskeyword' setting
setl isk&vim

" types
syn match    endoTypeName   "\<\u[a-zA-Z0-9_]*\>"

" symbol names
syn match    endoSymbol     "\%(let\|and\|use\|rec\|mut\|global\|export\)\@<=\s\+\zs[a-zA-Z_][a-zA-Z0-9_]*"

" errors
syn match    endoBraceErr   "}"
syn match    endoBrackErr   "\]"
syn match    endoParenErr   ")"
syn match    endoCommentErr "\*)"

" enclosing delimiters
syn region   endoEncl transparent matchgroup=endoKeyword start="(" end=")" contains=TOP,endoParenErr
syn region   endoEncl transparent matchgroup=endoKeyword start="{" end="}" contains=TOP,endoBraceErr
syn region   endoEncl transparent matchgroup=endoKeyword start="\[" end="\]" contains=TOP,endoBrackErr

" comments
syn keyword  endoTodo contained TODO FIXME XXX NOTE
syn match    endoSingleLineComment "//.*$" contains=endoTodo,@Spell
syn match    endoSingleLineComment "#.*$"  contains=endoTodo,@Spell
syn region   endoMultiLineComment start="(\*" end="\*)" contains=endoTodo,endoMultiLineComment,@Spell

" keywords
syn keyword endoControl      if then else elif end for in do while match with when
syn keyword endoControl      try finally return break continue
syn keyword endoKeyword      let mut fun type rec and of as export global lazy use
syn keyword endoKeyword      ref manual passthrough seq yield

syn keyword endoShellBuiltin cd echo pwd export rm exit env read time fg bg
syn keyword endoShellBuiltin source alias unalias set unset jobs kill wait
syn keyword endoShellBuiltin eval test true false

syn keyword endoCoreFunction print println each map filter fold reduce length
syn keyword endoCoreFunction head tail take drop sort sortBy reverse zip
syn keyword endoCoreFunction find forall exists distinct flatten
syn keyword endoCoreFunction group groupBy join split replace trim toLower
syn keyword endoCoreFunction toUpper startsWith endsWith lines words rand exec
syn keyword endoCoreFunction force which fetch id nth mem isEmpty
syn match   endoCoreFunction "\<contains\>"

" constants
syn keyword  endoBoolean   true false

" types
syn keyword  endoType      unit bool int float str list option result

" core classes
syn keyword  endoCoreClass Size DateTime TimeSpan Markdown Json Process Path
syn keyword  endoCoreClass KeyBindingInfo ProcessInfo JobInfo
syn keyword  endoCoreClass File FileHandle FileInfo FileMode

" options
syn keyword  endoOption    Some None Ok Error

" strings
syn match   endoStringS        "'[^']*'"

syn match   endoEscape         "\\[nrt\\\"$0]" contained

" interpolated strings
syn region  endoInterpFSharp   start="{" end="}" contains=TOP contained keepend
syn match   endoInterpEscBrace "{{" contained
syn match   endoInterpEscBrace "}}" contained
syn region  endoStringF        start=+\$"+ skip=+\\"+ end=+"+
            \ contains=endoEscape,endoInterpFSharp,endoInterpEscBrace

" double-quoted shell strings
syn region  endoStringD        start=+"+ skip=+\\"+ end=+"+
            \ contains=endoEscape,endoVar,endoVarSpecial,endoInterpBrace,endoInterpCmd,endoInterpArith

" operators
syn match endoLabel         "\<_\>"

syn match endoOperator      "<"
syn match endoOperator      ">"
syn match endoOperator      "\.\."
syn match endoOperator      "\.\.\."

syn match    endoKeyChar    "|"
syn match    endoKeyChar    ";"
syn match    endoKeyChar    "\~"
syn match    endoKeyChar    "?"
syn match    endoKeyChar    "\*\%()\)\@!"
syn match    endoKeyChar    "+"
syn match    endoKeyChar    "-"
syn match    endoKeyChar    "/\%(/\)\@!"
syn match    endoKeyChar    "!"
syn match    endoKeyChar    "%"
syn match    endoKeyChar    "@"
syn match    endoKeyChar    "&"
syn match    endoKeyChar    "="

syn match    endoOperator   "<-"

syn match    endoFunDef     "->"
syn match    endoTopStop    ";;"
syn match    endoOperator   "\^"
syn match    endoOperator   "::"

" numbers
syn match    endoNumber     "\<\d\+"
syn match    endoNumber     "\<0[xX][0-9a-fA-F]\+"
syn match    endoNumber     "\<0[oO][0-7]\+"
syn match    endoNumber     "\<0[bB][01]\+"
syn match    endoFloat      "\<\d\+\.\d\+\([eE][+-]\?\d\+\)\?"
syn match    endoFloat      "\<\d\+[eE][+-]\?\d\+"
syn match    endoNumber     "\<\d\+\(\.\d\+\)\?\(TB\|GB\|MB\|KB\|B\)\>"
syn match    endoNumber     "\<\d\+\(\.\d\+\)\?\(ms\|min\|h\|s\)\>"

" shell variables
syn match   endoVar         "\$[A-Za-z_][A-Za-z0-9_]*"
syn match   endoVarSpecial  "\$[?#!$*@0-9]"
syn region  endoInterpBrace start="\${" end="}" contains=TOP keepend
syn region  endoInterpCmd   start="\$(" end=")" contains=TOP keepend
syn region  endoInterpArith start="\$((" end="))" contains=TOP keepend

if version >= 508 || !exists("did_endo_syntax_inits")
    if version < 508
        let did_endo_syntax_inits = 1
        command -nargs=+ HiLink hi link <args>
    else
        command -nargs=+ HiLink hi def link <args>
    endif

    HiLink endoBraceErr          Error
    HiLink endoBrackErr          Error
    HiLink endoParenErr          Error
    HiLink endoCommentErr        Error

    HiLink endoSingleLineComment Comment
    HiLink endoMultiLineComment  Comment

    HiLink endoControl           Keyword
    HiLink endoKeyword           Keyword

    HiLink endoSymbol            Function
    HiLink endoShellBuiltin      Function
    HiLink endoCoreFunction      Function

    HiLink endoFunDef            Operator
    HiLink endoTopStop           Operator
    HiLink endoKeyChar           Operator
    HiLink endoOperator          Operator

    HiLink endoBoolean           Boolean
    HiLink endoNumber            Number
    HiLink endoFloat             Float

    HiLink endoStringS           String
    HiLink endoStringD           String
    HiLink endoStringF           String
    HiLink endoEscape            Special
    HiLink endoInterpEscBrace    Special
    HiLink endoInterpBrace       PreProc
    HiLink endoInterpCmd         PreProc
    HiLink endoInterpArith       PreProc
    HiLink endoInterpFSharp      PreProc

    HiLink endoLabel             Identifier
    HiLink endoOption            Identifier
    HiLink endoTypeName          Identifier

    HiLink endoType              Type

    HiLink endoCoreClass         Typedef

    HiLink endoVar               Identifier
    HiLink endoVarSpecial        Identifier

    HiLink endoTodo              Todo

    HiLink endoEncl              Delimiter

    delcommand HiLink
endif

let b:current_syntax = 'endo'

" vim: sw=4 et sts=4

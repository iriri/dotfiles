HISTFILE=~/.zsh_history
HISTSIZE=10000000
SAVEHIST=10000000
bindkey -e
bindkey "^[[3~" delete-char
bindkey "^[[4~" delete-char
setopt histignorespace
setopt noincappendhistory
setopt nosharehistory
setopt no_beep
PROMPT="%F{004}[%F{002}%* %F{013}%n%F{004}]%f "
RPROMPT="%F{008}%#%F{004}%2C"
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^x^e' edit-command-line

export EDITOR=vim
export VISUAL=vim

if [ "$TERM" = "rxvt-unicode-256color" ]; then
    TERM=xterm-16color
    precmd() {print -Pn "\e]0;zsh\a"}
    preexec() {printf "\033]0;%s\a" "$1"}
fi

alias gorp="gorp --color --git"
alias grep="grep --color"
alias ls="ls --color"
alias rm="rm -i"

. /usr/share/fzf/key-bindings.zsh
export FZF_DEFAULT_OPTS="--reverse --inline-info --preview 'head -100 {}'"

export GO111MODULE=on
export GOPATH=~/devel/go
PATH=$GOPATH/bin:$PATH

. ~/.opam/opam-init/init.zsh > /dev/null 2> /dev/null || true
alias ocaml="rlwrap ocaml -init ~/.ocamlinit_"
export OPAMUTF8MSGS=no
export OPAMUTF8=never

alias elm-format="elm-format --elm-version 0.19"
alias elm-fmt="elm-format --elm-version 0.19 --yes ."

PATH=~/.cargo/bin:$PATH
export RUST_SRC_PATH="$(rustc --print sysroot)/lib/rustlib/src/rust/src"

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
RPROMPT="%F{008}%#%F{005}%2C"
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^x^e' edit-command-line

chpwd() { print -Pn "\e]2;%2C\a" }
chpwd

export EDITOR=vim
export VISUAL=vim
export LIBRARY_PATH=/usr/local/lib
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin
MANPATH=/usr/local/man:$MANPATH
man() {
    env \
    LESS_TERMCAP_mb="$(printf "\e[1;31m")" \
    LESS_TERMCAP_md="$(printf "\e[1;31m")" \
    LESS_TERMCAP_me="$(printf "\e[0m")" \
    LESS_TERMCAP_se="$(printf "\e[0m")" \
    LESS_TERMCAP_so="$(printf "\e[1;44;33m")" \
    LESS_TERMCAP_ue="$(printf "\e[0m")" \
    LESS_TERMCAP_us="$(printf "\e[1;32m")" \
    man "${@}"
}

alias gorp="gorp --color --git"
alias grep="ggrep --color"
alias ls="ls -G"
alias rm="rm -i"

. "/usr/local/opt/fzf/shell/key-bindings.zsh"
export FZF_DEFAULT_OPTS="--reverse --inline-info --preview 'head -100 {}'"

export HOMEBREW_NO_ANALYTICS=1
export HOMEBREW_CASK_OPTS="--appdir=~/Applications"

export GO111MODULE=on
export GOROOT=/usr/local/opt/go/libexec
export GOPATH=~/devel/go
PATH=$GOROOT/bin:$GOPATH/bin:$PATH

. ~/.opam/opam-init/init.zsh > /dev/null 2> /dev/null || true
eval `opam config env`
alias ocaml="rlwrap ocaml"

PATH=~/.cargo/bin:$PATH
export RUST_SRC_PATH="$(rustc --print sysroot)/lib/rustlib/src/rust/src"

colo default
syntax enable
filetype plugin indent on
set bs=2
set nu
set nois
set hls
set et
set sts=4
set ai
set sw=4
set vb
set t_vb=
set hid
set list
set lcs=eol:$,tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
hi CursorLine cterm=NONE ctermbg=0 ctermfg=NONE
set cot=menuone,longest

au BufRead,BufNewFile *
  \ if &ft == 'myr' || &ft == 'mbld' || &ft == 'go' |
  \   2mat ErrorMsg '\%100v.' |
  \ elseif &ft == 'rust' |
  \   2mat ErrorMsg '\%101v.' |
  \ else |
  \   2mat ErrorMsg '\%80v.' |
  \ endif

au BufReadPost *
  \ if line("'\"") >= 1 && line("'\"") <= line('$') && &ft !~# 'commit' |
  \   exe "normal! g`\"" |
  \ endif

au FileType myr,mbld,go
  \ setl noet |
  \ setl sts=8 |
  \ setl sw=8

au FileType ocaml setl commentstring=(*%s*) | setl sts=2 | setl sw=2
let g:opamshare = substitute(system('opam config var share'), '\n$', '', '')
exe 'set rtp^=' . g:opamshare . '/merlin/vim'
exe 'set rtp^=' . g:opamshare . '/ocp-indent/vim'

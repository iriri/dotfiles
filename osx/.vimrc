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
2mat ErrorMsg '\%80v.'

au BufNew * au BufAdd <buffer=abuf> 2mat ErrorMsg '\%80v.'

au BufReadPost *
  \ if line("'\"") >= 1 && line("'\"") <= line("$") && &ft !~# 'commit' |
  \   exe "normal! g`\"" |
  \ endif

call plug#begin('~/.vim/plugged')
Plug 'scrooloose/syntastic'
Plug 'tpope/vim-commentary'
Plug 'fatih/vim-go'
Plug 'zig-lang/zig.vim'
Plug 'rust-lang/rust.vim'
Plug 'racer-rust/vim-racer'
Plug 'airblade/vim-gitgutter', { 'on': 'GitGutterEnable' }
call plug#end()

au FileType myr,mbld,go
  \ setl noet |
  \ setl sts=8 |
  \ setl sw=8 |
  \ 2mat ErrorMsg '\%100v.'

au FileType ocaml setl commentstring=(*%s*) |
  \ setl sts=2 |
  \ setl sw=2 |
  \ let g:syntastic_ocaml_checkers = ['merlin']
let g:opamshare = substitute(system('opam config var share'), '\n$', '', '')
exe "set rtp^=" . g:opamshare . "/merlin/vim"
exe "set rtp^=" . g:opamshare . "/ocp-indent/vim"

au FileType rust let g:rustfmt_autosave = 1 |
  \ let g:racer_cmd = "~/.cargo/bin/racer" |
  \ let g:racer_experimental_completer = 1 |
  \ nmap gd <Plug>(rust-def) |
  \ nmap gs <Plug>(rust-def-split) |
  \ nmap gx <Plug>(rust-def-vertical) |
  \ nmap <leader>gd <Plug>(rust-doc) |
  \ 2mat ErrorMsg '\%101v.'
